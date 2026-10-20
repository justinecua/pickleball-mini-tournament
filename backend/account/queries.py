"""
Accounts: sign-up, login (token auth), the signed-in user's profile, and the
site admin's user list.

  - Anyone can register, and any signed-in user can host tournaments. Site
    admins (is_staff) can manage every tournament; the first is made with
    `createsuperuser`.
  - Login accepts a username or an email address.
  - A profile row holds the "looking for a partner" flag used by registration.
    A player's team in a tournament comes from their registration there.
  - Admins can grant or revoke admin and delete accounts, but never remove
    their own admin access.

Example:
    login({"username": "maya@example.com", "password": "..."})
    -> {"token": "9f2c...", "user": {"id": 4, "username": "maya", ...}}
"""

from django.contrib.auth import authenticate, password_validation
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from rest_framework.authtoken.models import Token

from core.db import Invalid, aware, connection, now, row, rows, to_bool, to_text

USER_SELECT = """
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_staff, u.date_joined,
           p.looking_for_partner, p.partner_note
    FROM auth_user u
    LEFT JOIN account_profile p ON p.user_id = u.id
"""


def user_dict(u):
    return {
        'id': u['id'],
        'username': u['username'],
        'email': u['email'],
        'first_name': u['first_name'],
        'last_name': u['last_name'],
        'is_staff': bool(u['is_staff']),
        'date_joined': aware(u['date_joined']),
        'looking_for_partner': bool(u['looking_for_partner']),
        'partner_note': u['partner_note'] or '',
    }


def display_name(first_name, last_name, username):
    """Same as User.get_full_name(), falling back to the username."""
    return f'{first_name or ""} {last_name or ""}'.strip() or username or ''


def fetch_user(cursor, user_id):
    cursor.execute(USER_SELECT + ' WHERE u.id = %s;', [user_id])
    found = row(cursor)
    return user_dict(found) if found else None


def ensure_profile(cursor, user_id):
    cursor.execute(
        """
        INSERT INTO account_profile (user_id, looking_for_partner, partner_note)
        SELECT %s, %s, ''
        WHERE NOT EXISTS (SELECT 1 FROM account_profile WHERE user_id = %s);
        """,
        [user_id, False, user_id],
    )


def set_profile(cursor, user_id, **fields):
    ensure_profile(cursor, user_id)
    assignments = ', '.join(f'{field} = %s' for field in fields)
    cursor.execute(f'UPDATE account_profile SET {assignments} WHERE user_id = %s;', [*fields.values(), user_id])


def _token(cursor, user_id):
    cursor.execute('SELECT key FROM authtoken_token WHERE user_id = %s;', [user_id])
    found = cursor.fetchone()
    if found:
        return found[0]
    key = Token.generate_key()
    cursor.execute('INSERT INTO authtoken_token (key, user_id, created) VALUES (%s, %s, %s);', [key, user_id, now()])
    return key


def _auth_payload(cursor, user_id):
    ensure_profile(cursor, user_id)
    return {'token': _token(cursor, user_id), 'user': fetch_user(cursor, user_id)}


def _clean_email(value, errors, required):
    email = (value or '').strip()
    if not email:
        if required:
            errors['email'] = ['This field is required.']
        return email
    try:
        validate_email(email)
    except DjangoValidationError:
        errors['email'] = ['Enter a valid email address.']
    return email


# --- Sign-up / login ----------------------------------------------------------

def register(data):
    errors = {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    names = {}
    for field in ('first_name', 'last_name'):
        try:
            names[field] = to_text(data.get(field), field, 150)
        except Invalid as exc:
            errors[field] = [exc.message]

    if not username:
        errors['username'] = ['This field is required.']
    elif len(username) > 150:
        errors['username'] = ['Ensure this field has no more than 150 characters.']
    else:
        try:
            UnicodeUsernameValidator()(username)
        except DjangoValidationError as exc:
            errors['username'] = list(exc.messages)
    email = _clean_email(data.get('email'), errors, required=True)
    if not password:
        errors['password'] = ['This field is required.']

    with transaction.atomic(), connection().cursor() as cursor:
        if 'username' not in errors:
            cursor.execute('SELECT 1 FROM auth_user WHERE username = %s;', [username])
            if cursor.fetchone():
                errors['username'] = ['A user with that username already exists.']
        if 'email' not in errors:
            cursor.execute('SELECT 1 FROM auth_user WHERE LOWER(email) = LOWER(%s);', [email])
            if cursor.fetchone():
                errors['email'] = ['An account with this email already exists.']
        if password and 'password' not in errors:
            candidate = User(username=username, email=email, **names)
            try:
                password_validation.validate_password(password, candidate)
            except DjangoValidationError as exc:
                errors['password'] = list(exc.messages)
        if errors:
            return {'error': 'Please fix the highlighted fields.', 'fields': errors}

        cursor.execute(
            """
            INSERT INTO auth_user
                (password, last_login, is_superuser, username, first_name, last_name, email,
                 is_staff, is_active, date_joined)
            VALUES (%s, NULL, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            [make_password(password), False, username, names.get('first_name', ''), names.get('last_name', ''),
             email, False, True, now()],
        )
        user_id = cursor.fetchone()[0]
        return _auth_payload(cursor, user_id)


def login(data):
    identifier = (data.get('username') or '').strip()
    password = data.get('password') or ''
    with connection().cursor() as cursor:
        # Allow signing in with either username or email.
        if '@' in identifier:
            cursor.execute('SELECT username FROM auth_user WHERE LOWER(email) = LOWER(%s) LIMIT 1;', [identifier])
            found = cursor.fetchone()
            identifier = found[0] if found else identifier
        user = authenticate(None, username=identifier, password=password)
        if user is None:
            return {'error': 'Incorrect username or password.'}
        return _auth_payload(cursor, user.pk)


def logout(user_id):
    with connection().cursor() as cursor:
        cursor.execute('DELETE FROM authtoken_token WHERE user_id = %s;', [user_id])


# --- Signed-in user -----------------------------------------------------------

def getMe(user_id):
    with connection().cursor() as cursor:
        ensure_profile(cursor, user_id)
        return fetch_user(cursor, user_id)


def updateMe(user_id, data):
    """Players may edit their name, email and partner-search details, never their role."""
    errors, account, profile = {}, {}, {}
    for field in ('first_name', 'last_name'):
        if field in data:
            try:
                account[field] = to_text(data[field], field, 150)
            except Invalid as exc:
                errors[field] = [exc.message]
    if 'email' in data:
        account['email'] = _clean_email(data['email'], errors, required=False)
    if 'looking_for_partner' in data:
        profile['looking_for_partner'] = to_bool(data['looking_for_partner'])
    if 'partner_note' in data:
        try:
            profile['partner_note'] = to_text(data['partner_note'], 'partner_note', 160)
        except Invalid as exc:
            errors['partner_note'] = [exc.message]
    if errors:
        return {'error': 'Please fix the highlighted fields.', 'fields': errors}

    with transaction.atomic(), connection().cursor() as cursor:
        if account:
            assignments = ', '.join(f'{field} = %s' for field in account)
            cursor.execute(f'UPDATE auth_user SET {assignments} WHERE id = %s;', [*account.values(), user_id])
        if profile:
            set_profile(cursor, user_id, **profile)
        ensure_profile(cursor, user_id)
        return fetch_user(cursor, user_id)


# --- Admin: users -------------------------------------------------------------

def getUsers():
    with connection().cursor() as cursor:
        cursor.execute(USER_SELECT + ' ORDER BY u.is_staff DESC, u.username;')
        return [user_dict(u) for u in rows(cursor)]


def updateUser(acting_user_id, user_id, data):
    errors, account = {}, {}
    for field in ('first_name', 'last_name'):
        if field in data:
            try:
                account[field] = to_text(data[field], field, 150)
            except Invalid as exc:
                errors[field] = [exc.message]
    if 'email' in data:
        account['email'] = _clean_email(data['email'], errors, required=False)
    if 'is_staff' in data:
        account['is_staff'] = to_bool(data['is_staff'])
        if user_id == acting_user_id and not account['is_staff']:
            return {'error': 'You cannot remove your own admin access.'}
    if errors:
        return {'error': 'Please fix the highlighted fields.', 'fields': errors}

    with transaction.atomic(), connection().cursor() as cursor:
        if fetch_user(cursor, user_id) is None:
            return {'error': 'Not found.', 'status': 404}
        if account:
            assignments = ', '.join(f'{field} = %s' for field in account)
            cursor.execute(f'UPDATE auth_user SET {assignments} WHERE id = %s;', [*account.values(), user_id])
        return fetch_user(cursor, user_id)


def deleteUser(acting_user_id, user_id):
    if user_id == acting_user_id:
        return {'error': 'You cannot delete your own account here.'}
    # The ORM delete is deliberate: Django handles the cascades (tokens, profile,
    # admin log, registrations) that a raw DELETE would trip over.
    deleted, _ = User.objects.filter(pk=user_id).delete()
    if not deleted:
        return {'error': 'Not found.', 'status': 404}
    return None
