"""
Small helpers shared by every app's queries.py.

  rows(cursor) / row(cursor)   - fetch results as dicts keyed by column name
  db_datetime / db_time / ...  - values in the form Django stores them, so raw
                                 INSERTs and UPDATEs match ORM-written rows
  aware(value)                 - datetimes read back from SQLite are naive UTC
  to_int / to_bool / to_text   - coerce request values (JSON or form-encoded)
"""

from datetime import date, datetime, time, timezone as dt_timezone

from django.db import connections
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_time


def connection():
    return connections['default']


def rows(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, values)) for values in cursor.fetchall()]


def row(cursor):
    found = rows(cursor)
    return found[0] if found else None


def aware(value):
    if isinstance(value, datetime) and timezone.is_naive(value):
        return timezone.make_aware(value, dt_timezone.utc)
    return value


def db_datetime(value):
    return connection().ops.adapt_datetimefield_value(value)


def db_time(value):
    return connection().ops.adapt_timefield_value(value)


def db_date(value):
    return connection().ops.adapt_datefield_value(value)


def now():
    return db_datetime(timezone.now())


class Invalid(Exception):
    """A request value could not be read; carries the field and message."""

    def __init__(self, field, message):
        super().__init__(message)
        self.field = field
        self.message = message


def to_int(value, field, minimum=None):
    if value in (None, ''):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise Invalid(field, 'A whole number is required.')
    if minimum is not None and number < minimum:
        raise Invalid(field, f'Must be at least {minimum}.')
    return number


def to_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('1', 'true', 'on', 'yes')


def to_text(value, field, max_length, required=False):
    text = '' if value is None else str(value).strip()
    if required and not text:
        raise Invalid(field, 'This field may not be blank.')
    if len(text) > max_length:
        raise Invalid(field, f'Ensure this field has no more than {max_length} characters.')
    return text


def to_time(value, field):
    parsed = value if isinstance(value, time) else parse_time(str(value or ''))
    if parsed is None:
        raise Invalid(field, 'Time has wrong format. Use hh:mm.')
    return parsed


def to_date(value, field):
    if value in (None, ''):
        return None
    parsed = value if isinstance(value, date) else parse_date(str(value))
    if parsed is None:
        raise Invalid(field, 'Date has wrong format. Use YYYY-MM-DD.')
    return parsed


def field_error(exc):
    """Turn an Invalid into the error value queries return."""
    return {'error': exc.message, 'fields': {exc.field: [exc.message]}}
