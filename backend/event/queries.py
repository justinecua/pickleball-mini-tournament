"""
Tournaments: creating and listing them, their details and courts, the run of
show, and the overview summary that pulls the other apps together.

  - Any signed-in user can create a tournament and becomes its host.
  - Courts are numbered 1..N (N = 1..8); court N hosts bracket N and has its
    own venue name and address.
  - Changing the number of courts or teams per bracket rebuilds the slots,
    games and run of show (event/schedule.py), so it is refused once scores
    exist; it also undoes the draw. Changing the start time or game length
    just moves the games, keeping results.
  - `drawn_at` is set by the draw (registration/queries.py) and is read-only here.

Example:
    updateTournament(1, {"courts": [{"venue_name": "Riverside", "address": "1 River Rd"}], "teams_per_bracket": 5})
    -> {"slug": "spring-open", "courts": [{"number": 1, "venue_name": "Riverside", ...}], ...}
"""

from django.db import transaction
from django.utils.text import slugify

from announcements.queries import latest as latest_announcements
from core.db import (
    Invalid, aware, connection, db_date, db_time, field_error, now, row, rows, to_bool, to_date, to_int, to_text,
    to_time,
)
from matches.queries import match_summary, placements, results_exist

from . import schedule

TOURNAMENT_FIELDS = ['id', 'host_id', 'slug', 'name', 'date', 'start_time', 'teams_per_bracket', 'game_minutes',
                     'format', 'notes', 'registration_open', 'drawn_at', 'created_at']
TOURNAMENT_SELECT = f'SELECT {", ".join(TOURNAMENT_FIELDS)} FROM event_tournament'


def _clean_row(found):
    if found:
        found['registration_open'] = bool(found['registration_open'])
        found['drawn_at'] = aware(found['drawn_at'])
        found['created_at'] = aware(found['created_at'])
    return found


def load_tournament(cursor, slug):
    cursor.execute(TOURNAMENT_SELECT + ' WHERE slug = %s;', [slug])
    return _clean_row(row(cursor))


def load_tournament_by_id(cursor, tid):
    cursor.execute(TOURNAMENT_SELECT + ' WHERE id = %s;', [tid])
    return _clean_row(row(cursor))


def load_courts(cursor, tid):
    cursor.execute(
        'SELECT number, venue_name, address FROM event_court WHERE tournament_id = %s ORDER BY number;', [tid]
    )
    return rows(cursor)


def _host(cursor, host_id):
    if host_id is None:
        return None
    cursor.execute('SELECT id, username, first_name, last_name FROM auth_user WHERE id = %s;', [host_id])
    u = row(cursor)
    if u is None:
        return None
    from account.queries import display_name
    return {'id': u['id'], 'name': display_name(u['first_name'], u['last_name'], u['username'])}


def tournament_dict(cursor, t):
    courts = load_courts(cursor, t['id'])
    return {
        **{k: v for k, v in t.items() if k != 'host_id'},
        'host': _host(cursor, t['host_id']),
        'courts': courts,
        'brackets': list(schedule.bracket_letters(len(courts))),
        'advancement': dict(zip(('per_bracket', 'wildcards'), schedule.advancement(len(courts)))),
    }


# --- Directory ----------------------------------------------------------------

def listTournaments(viewer_id=None):
    """Every tournament, newest first, with what the directory cards need."""
    from registration.queries import registration_status

    with connection().cursor() as cursor:
        cursor.execute(TOURNAMENT_SELECT + ' ORDER BY date IS NULL, date DESC, created_at DESC;')
        found = [_clean_row(t) for t in rows(cursor)]
        result = []
        for t in found:
            courts = load_courts(cursor, t['id'])
            my_status = None
            if viewer_id:
                cursor.execute(
                    """
                    SELECT status FROM registration_entry
                    WHERE tournament_id = %s AND (captain_id = %s OR partner_id = %s) AND status <> 'withdrawn'
                    ORDER BY created_at LIMIT 1;
                    """,
                    [t['id'], viewer_id, viewer_id],
                )
                hit = cursor.fetchone()
                my_status = hit[0] if hit else None
            result.append({
                'slug': t['slug'], 'name': t['name'], 'date': t['date'], 'start_time': t['start_time'],
                'host': _host(cursor, t['host_id']),
                'is_host': viewer_id is not None and viewer_id == t['host_id'],
                'courts': len(courts),
                'venues': sorted({c['venue_name'] for c in courts if c['venue_name']}),
                'registration': registration_status(cursor, t['id']),
                'my_status': my_status,
            })
        return result


def _unique_slug(cursor, name, exclude_id=None):
    base = slugify(name)[:70] or 'tournament'
    slug, n = base, 2
    while True:
        cursor.execute('SELECT id FROM event_tournament WHERE slug = %s;', [slug])
        hit = cursor.fetchone()
        if hit is None or hit[0] == exclude_id:
            return slug
        slug, n = f'{base}-{n}', n + 1


# --- Details and courts -------------------------------------------------------

def _clean_courts(value):
    """A list of {venue_name, address}, one per court in order; or a plain number of courts."""
    if isinstance(value, (int, str)) and not isinstance(value, bool):
        count = to_int(value, 'courts', minimum=1)
        courts = [{} for _ in range(count or 0)]
    elif isinstance(value, list):
        courts = [c if isinstance(c, dict) else {} for c in value]
    else:
        raise Invalid('courts', 'Give a list of courts.')
    if not 1 <= len(courts) <= schedule.MAX_COURTS:
        raise Invalid('courts', f'Use between 1 and {schedule.MAX_COURTS} courts.')
    return [
        {'venue_name': to_text(c.get('venue_name'), 'courts', 120), 'address': to_text(c.get('address'), 'courts', 240)}
        for c in courts
    ]


def _clean_details(data, creating):
    fields = {}
    if 'name' in data or creating:
        fields['name'] = to_text(data.get('name'), 'name', 120, required=True)
    if 'format' in data:
        fields['format'] = to_text(data['format'], 'format', 80, required=True)
    if 'notes' in data:
        fields['notes'] = '' if data['notes'] is None else str(data['notes'])
    if 'date' in data:
        fields['date'] = db_date(to_date(data['date'], 'date'))
    if 'start_time' in data:
        fields['start_time'] = db_time(to_time(data['start_time'], 'start_time'))
    if 'game_minutes' in data:
        value = to_int(data['game_minutes'], 'game_minutes', minimum=5)
        if value is None:
            raise Invalid('game_minutes', 'A valid integer is required.')
        fields['game_minutes'] = value
    if 'teams_per_bracket' in data:
        low, high = schedule.TEAMS_PER_BRACKET
        value = to_int(data['teams_per_bracket'], 'teams_per_bracket')
        if value is None or not low <= value <= high:
            raise Invalid('teams_per_bracket', f'Use between {low} and {high} teams per bracket.')
        fields['teams_per_bracket'] = value
    if 'registration_open' in data:
        fields['registration_open'] = to_bool(data['registration_open'])
    return fields


def _save_courts(cursor, tid, courts):
    cursor.execute('DELETE FROM event_court WHERE tournament_id = %s AND number > %s;', [tid, len(courts)])
    for number, c in enumerate(courts, start=1):
        cursor.execute(
            'UPDATE event_court SET venue_name = %s, address = %s WHERE tournament_id = %s AND number = %s;',
            [c['venue_name'], c['address'], tid, number],
        )
        if cursor.rowcount == 0:
            cursor.execute(
                'INSERT INTO event_court (tournament_id, number, venue_name, address) VALUES (%s, %s, %s, %s);',
                [tid, number, c['venue_name'], c['address']],
            )


def getTournament(tid, viewer_id=None, is_host=False):
    from registration.queries import my_team, registration_status

    with connection().cursor() as cursor:
        t = load_tournament_by_id(cursor, tid)
        return {
            **tournament_dict(cursor, t),
            'is_host': is_host,
            'registration': registration_status(cursor, tid),
            'my_team': my_team(cursor, tid, viewer_id),
        }


def createTournament(user_id, data):
    try:
        fields = _clean_details(data, creating=True)
        courts = _clean_courts(data.get('courts', 4))
    except Invalid as exc:
        return field_error(exc)
    with transaction.atomic(), connection().cursor() as cursor:
        fields = {
            'start_time': db_time(to_time('18:00', 'start_time')), 'teams_per_bracket': 4, 'game_minutes': 20,
            'format': 'Doubles (2 players per team)',
            'notes': 'Please be ready 10 minutes before your scheduled match.', 'registration_open': True,
            **fields,
            'host_id': user_id, 'slug': _unique_slug(cursor, fields['name']), 'created_at': now(),
        }
        columns = ', '.join(f'"{field}"' for field in fields)
        marks = ', '.join(['%s'] * len(fields))
        cursor.execute(f'INSERT INTO event_tournament ({columns}) VALUES ({marks}) RETURNING id;', list(fields.values()))
        tid = cursor.fetchone()[0]
        _save_courts(cursor, tid, courts)
        schedule.build(tid)
    return getTournament(tid, user_id, is_host=True)


def updateTournament(tid, data, viewer_id=None):
    from registration.queries import promote_waitlist

    try:
        fields = _clean_details(data, creating=False)
        courts = _clean_courts(data['courts']) if 'courts' in data else None
    except Invalid as exc:
        return field_error(exc)

    with transaction.atomic(), connection().cursor() as cursor:
        current = load_tournament_by_id(cursor, tid)
        court_count = len(load_courts(cursor, tid))
        resize = (courts is not None and len(courts) != court_count) or (
            'teams_per_bracket' in fields and fields['teams_per_bracket'] != current['teams_per_bracket'])
        retime = any(f in fields and str(fields[f]) != str(current[f]) for f in ('start_time', 'game_minutes'))
        if resize and results_exist(cursor, tid):
            message = 'Scores have been entered. Reset all results before changing courts or teams per bracket.'
            return {'error': message, 'fields': {'courts' if courts is not None else 'teams_per_bracket': [message]}}

        if fields:
            assignments = ', '.join(f'"{field}" = %s' for field in fields)
            cursor.execute(f'UPDATE event_tournament SET {assignments} WHERE id = %s;', [*fields.values(), tid])
        if 'name' in fields and fields['name'] != current['name']:
            cursor.execute('UPDATE event_tournament SET slug = %s WHERE id = %s;', [_unique_slug(cursor, fields['name'], tid), tid])
        if courts is not None:
            _save_courts(cursor, tid, courts)
        if resize:
            schedule.build(tid)
            promote_waitlist(cursor, tid)
        elif retime:
            schedule.retime(tid)
    return getTournament(tid, viewer_id, is_host=True)


def deleteTournament(tid):
    # The ORM delete is deliberate: it cascades to courts, slots, games, entries and notices.
    from .models import Tournament
    Tournament.objects.filter(pk=tid).delete()
    return None


# --- Run of show ---------------------------------------------------------------

TIMELINE_SELECT = 'SELECT id, "order", start_time, end_time, activity, games, details FROM event_timelineevent'


def _fetch_event(cursor, tid, event_id):
    cursor.execute(TIMELINE_SELECT + ' WHERE id = %s AND tournament_id = %s;', [event_id, tid])
    return row(cursor)


def _clean_event(data, partial):
    fields = {}
    if 'order' in data or not partial:
        value = to_int(data.get('order'), 'order', minimum=0)
        if value is None:
            raise Invalid('order', 'This field is required.')
        fields['order'] = value
    for field in ('start_time', 'end_time'):
        if field in data or not partial:
            fields[field] = db_time(to_time(data.get(field), field))
    if 'activity' in data or not partial:
        fields['activity'] = to_text(data.get('activity'), 'activity', 80, required=True)
    if 'games' in data or not partial:
        fields['games'] = to_int(data.get('games'), 'games', minimum=0)
    if 'details' in data or not partial:
        fields['details'] = to_text(data.get('details'), 'details', 160)
    return fields


def timeline(cursor, tid):
    cursor.execute(TIMELINE_SELECT + ' WHERE tournament_id = %s ORDER BY "order", id;', [tid])
    return rows(cursor)


def getTimeline(tid):
    with connection().cursor() as cursor:
        return timeline(cursor, tid)


def getTimelineEvent(tid, event_id):
    with connection().cursor() as cursor:
        found = _fetch_event(cursor, tid, event_id)
    return found or {'error': 'Not found.', 'status': 404}


def createTimelineEvent(tid, data):
    try:
        fields = {**_clean_event(data, partial=False), 'tournament_id': tid}
    except Invalid as exc:
        return field_error(exc)
    with transaction.atomic(), connection().cursor() as cursor:
        columns = ', '.join(f'"{field}"' for field in fields)
        marks = ', '.join(['%s'] * len(fields))
        cursor.execute(f'INSERT INTO event_timelineevent ({columns}) VALUES ({marks}) RETURNING id;', list(fields.values()))
        return _fetch_event(cursor, tid, cursor.fetchone()[0])


def updateTimelineEvent(tid, event_id, data):
    try:
        fields = _clean_event(data, partial=True)
    except Invalid as exc:
        return field_error(exc)
    with transaction.atomic(), connection().cursor() as cursor:
        if _fetch_event(cursor, tid, event_id) is None:
            return {'error': 'Not found.', 'status': 404}
        if fields:
            assignments = ', '.join(f'"{field}" = %s' for field in fields)
            cursor.execute(f'UPDATE event_timelineevent SET {assignments} WHERE id = %s;', [*fields.values(), event_id])
        return _fetch_event(cursor, tid, event_id)


def deleteTimelineEvent(tid, event_id):
    with connection().cursor() as cursor:
        cursor.execute('DELETE FROM event_timelineevent WHERE id = %s AND tournament_id = %s;', [event_id, tid])
        if cursor.rowcount == 0:
            return {'error': 'Not found.', 'status': 404}
    return None


# --- Overview -----------------------------------------------------------------

def getSummary(tid):
    # Imported here: registration reads the tournament, so a top-level import would be circular.
    from registration.queries import registration_status

    with connection().cursor() as cursor:
        t = load_tournament_by_id(cursor, tid)
        cursor.execute('SELECT COUNT(*) FROM teams_team WHERE tournament_id = %s;', [tid])
        teams = cursor.fetchone()[0]
        return {
            'info': {**tournament_dict(cursor, t), 'teams': teams, 'players': teams * 2},
            **match_summary(cursor, tid),
            'placements': placements(cursor, tid),
            'announcements': latest_announcements(cursor, tid, 5),
            'registration': registration_status(cursor, tid),
        }
