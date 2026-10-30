"""
Team registration, the bracket draw, and game-day check-in, per tournament.

  - A player creates a team in a tournament (they become captain) and shares
    its invite code. The team is confirmed the moment a partner joins: the
    first N complete teams (N = the tournament's bracket slots) are confirmed,
    later ones go on a waitlist and move up automatically when a confirmed
    team withdraws. A player can be on one team per tournament.
  - Hosts can also add teams by name (no accounts needed) and remove teams.
  - Site admins can override the locks (with `force`): add, pair or remove teams
    after the draw (a new team takes a random open slot, a removed team's slot
    goes to the next waitlisted team or becomes an open slot), and swap or
    redraw after scores.
  - Solo players flag "looking for a partner"; a host pairs two of them.
  - The draw shuffles confirmed teams into the bracket slots (teams_team),
    clears results and closes registration. Slots can be swapped until the
    first score is entered.
  - Each confirmed team has a check-in ticket: a UUID (in the QR) whose first
    8 hex characters are the code printed under it.

Example:
    joinEntry(12, {"code": "PSAN83"})
    -> {"id": 3, "name": "Kitchen Kings", "status": "confirmed", "position": 1, ...}
"""

import random
import uuid

from django.db import transaction

from account.queries import display_name, set_profile
from core.db import Invalid, aware, connection, field_error, now, rows, to_text
from event.queries import load_tournament_by_id
from matches.queries import clear_results, resolve_knockouts, results_exist
from teams.queries import all_teams, team_dict

from .models import Entry, invite_code

FORMING, CONFIRMED, WAITLIST, WITHDRAWN = Entry.FORMING, Entry.CONFIRMED, Entry.WAITLIST, Entry.WITHDRAWN
ACTIVE = (FORMING, CONFIRMED, WAITLIST)
STATUS_DISPLAY = dict(Entry.STATUSES)

ENTRY_SELECT = """
    SELECT e.id, e.tournament_id, e.name, e.captain_id, e.partner_id, e.player1, e.player2, e.invite_code,
           e.status, e.created_at, e.confirmed_at, e.checkin_token, e.checked_in_at, e.slot_id,
           c.username AS c_username, c.first_name AS c_first, c.last_name AS c_last,
           p.username AS p_username, p.first_name AS p_first, p.last_name AS p_last,
           s.id AS s_id, s.name AS s_name, s.player1 AS s_player1, s.player2 AS s_player2,
           s.bracket AS s_bracket, s.seed AS s_seed,
           t.slug AS t_slug, t.name AS t_name
    FROM registration_entry e
    JOIN event_tournament t ON t.id = e.tournament_id
    LEFT JOIN auth_user c ON c.id = e.captain_id
    LEFT JOIN auth_user p ON p.id = e.partner_id
    LEFT JOIN teams_team s ON s.id = e.slot_id
"""


# --- Reading entries ----------------------------------------------------------

def _token(e):
    return uuid.UUID(str(e['checkin_token']))


def _captain_name(e):
    return display_name(e['c_first'], e['c_last'], e['c_username']) if e['captain_id'] else e['player1']


def _partner_name(e):
    return display_name(e['p_first'], e['p_last'], e['p_username']) if e['partner_id'] else e['player2']


def entry_public(e, positions):
    return {
        'id': e['id'],
        'tournament': {'slug': e['t_slug'], 'name': e['t_name']},
        'name': e['name'],
        'status': e['status'],
        'status_display': STATUS_DISPLAY.get(e['status'], e['status']),
        'captain_name': _captain_name(e),
        'partner_name': _partner_name(e),
        'added_by_host': e['captain_id'] is None,
        'position': positions.get(e['id']),
        'checked_in': e['checked_in_at'] is not None,
        'slot': team_dict(e, 's_'),
        'created_at': aware(e['created_at']),
    }


def entry_private(e, positions, viewer_id=None):
    """For the team's own players and hosts: adds the invite code and, once confirmed, the ticket."""
    confirmed = e['status'] == CONFIRMED
    return {
        **entry_public(e, positions),
        'invite_code': e['invite_code'],
        'captain': e['captain_id'],
        'partner': e['partner_id'],
        'checkin_token': str(_token(e)) if confirmed else None,
        'checkin_code': _token(e).hex[:8].upper() if confirmed else None,
        'checked_in_at': aware(e['checked_in_at']),
        'confirmed_at': aware(e['confirmed_at']),
        'is_captain': viewer_id is not None and viewer_id == e['captain_id'],
    }


def fetch_entries(cursor, where='', params=()):
    cursor.execute(ENTRY_SELECT + where + ' ORDER BY e.created_at, e.id;', list(params))
    return rows(cursor)


def fetch_entry(cursor, entry_id):
    found = fetch_entries(cursor, ' WHERE e.id = %s', [entry_id])
    return found[0] if found else None


def positions(cursor, tid):
    """Queue numbers: confirmed teams 1..n and waitlisted teams 1..k, both in completion order."""
    numbers = {}
    for status in (CONFIRMED, WAITLIST):
        cursor.execute(
            'SELECT id FROM registration_entry WHERE tournament_id = %s AND status = %s ORDER BY confirmed_at, id;',
            [tid, status],
        )
        numbers.update({entry_id: n for n, (entry_id,) in enumerate(cursor.fetchall(), start=1)})
    return numbers


def capacity(cursor, tid):
    cursor.execute('SELECT COUNT(*) FROM teams_team WHERE tournament_id = %s;', [tid])
    return cursor.fetchone()[0]


def active_entry_id(cursor, tid, user_id):
    cursor.execute(
        """
        SELECT id FROM registration_entry
        WHERE tournament_id = %s AND (captain_id = %s OR partner_id = %s) AND status IN (%s, %s, %s)
        ORDER BY created_at LIMIT 1;
        """,
        [tid, user_id, user_id, *ACTIVE],
    )
    found = cursor.fetchone()
    return found[0] if found else None


def my_team(cursor, tid, user_id):
    """The bracket slot the user's team was drawn into, if any."""
    entry_id = user_id and active_entry_id(cursor, tid, user_id)
    if not entry_id:
        return None
    return team_dict(fetch_entry(cursor, entry_id), 's_')


def _count(cursor, tid, status):
    cursor.execute('SELECT COUNT(*) FROM registration_entry WHERE tournament_id = %s AND status = %s;', [tid, status])
    return cursor.fetchone()[0]


def registration_status(cursor, tid):
    t = load_tournament_by_id(cursor, tid)
    return {
        'open': t['registration_open'] and not t['drawn_at'],
        'drawn': t['drawn_at'] is not None,
        'capacity': capacity(cursor, tid),
        'confirmed': _count(cursor, tid, CONFIRMED),
        'waitlist': _count(cursor, tid, WAITLIST),
        'forming': _count(cursor, tid, FORMING),
    }


def _closed_reason(cursor, tid):
    """Why teams can't change right now, or None when registration is open."""
    t = load_tournament_by_id(cursor, tid)
    if t['drawn_at']:
        return 'The draw has already been made, so teams can no longer change.'
    if not t['registration_open']:
        return 'Registration is closed.'
    return None


# --- Queue rules --------------------------------------------------------------

def _confirm(cursor, tid, entry_id):
    """Called when a team becomes complete: confirmed if a spot is free, otherwise waitlisted."""
    cursor.execute(
        'SELECT COUNT(*) FROM registration_entry WHERE tournament_id = %s AND status = %s AND id <> %s;',
        [tid, CONFIRMED, entry_id],
    )
    full = cursor.fetchone()[0] >= capacity(cursor, tid)
    cursor.execute(
        'UPDATE registration_entry SET status = %s, confirmed_at = %s WHERE id = %s;',
        [WAITLIST if full else CONFIRMED, now(), entry_id],
    )


def promote_waitlist(cursor, tid):
    """Move waitlisted teams into free spots; drop confirmed teams back if the field got smaller."""
    while _count(cursor, tid, CONFIRMED) < capacity(cursor, tid):
        cursor.execute(
            """
            SELECT id FROM registration_entry WHERE tournament_id = %s AND status = %s
            ORDER BY confirmed_at, id LIMIT 1;
            """,
            [tid, WAITLIST],
        )
        nxt = cursor.fetchone()
        if nxt is None:
            return
        cursor.execute('UPDATE registration_entry SET status = %s WHERE id = %s;', [CONFIRMED, nxt[0]])
    while _count(cursor, tid, CONFIRMED) > capacity(cursor, tid):
        cursor.execute(
            """
            SELECT id FROM registration_entry WHERE tournament_id = %s AND status = %s
            ORDER BY confirmed_at DESC, id DESC LIMIT 1;
            """,
            [tid, CONFIRMED],
        )
        cursor.execute('UPDATE registration_entry SET status = %s WHERE id = %s;', [WAITLIST, cursor.fetchone()[0]])


def _new_invite_code(cursor):
    while True:
        code = invite_code()
        cursor.execute('SELECT 1 FROM registration_entry WHERE invite_code = %s;', [code])
        if not cursor.fetchone():
            return code


def _insert_entry(cursor, tid, name, captain_id=None, partner_id=None, player1='', player2=''):
    token = Entry._meta.get_field('checkin_token').get_db_prep_value(uuid.uuid4(), connection())
    cursor.execute(
        """
        INSERT INTO registration_entry
            (tournament_id, name, captain_id, partner_id, player1, player2, invite_code, status, created_at,
             confirmed_at, checkin_token, checked_in_at, slot_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, %s, NULL, NULL)
        RETURNING id;
        """,
        [tid, name[:80], captain_id, partner_id, player1, player2, _new_invite_code(cursor), FORMING, now(), token],
    )
    return cursor.fetchone()[0]


# --- Players ------------------------------------------------------------------

def getEntries(tid, viewer_id=None, is_host=False):
    with connection().cursor() as cursor:
        if is_host:
            found = fetch_entries(cursor, ' WHERE e.tournament_id = %s', [tid])
        else:
            found = fetch_entries(cursor, ' WHERE e.tournament_id = %s AND e.status <> %s', [tid, WITHDRAWN])
        numbers = positions(cursor, tid)
        if is_host:
            return [entry_private(e, numbers, viewer_id) for e in found]
        return [entry_public(e, numbers) for e in found]


def getMyEntry(tid, user_id):
    with connection().cursor() as cursor:
        entry_id = active_entry_id(cursor, tid, user_id)
        if entry_id is None:
            return None
        return entry_private(fetch_entry(cursor, entry_id), positions(cursor, tid), user_id)


def getInvite(code):
    with connection().cursor() as cursor:
        found = fetch_entries(cursor, ' WHERE e.invite_code = %s', [(code or '').upper()])
        if not found or found[0]['status'] == WITHDRAWN or found[0]['captain_id'] is None:
            return {'error': 'That invite code is not valid.', 'status': 404}
        return entry_public(found[0], positions(cursor, found[0]['tournament_id']))


def createEntry(tid, user_id, data):
    name = str(data.get('name') or '').strip()
    if not name:
        return {'error': 'Give your team a name.', 'fields': {'name': ['Give your team a name.']}}
    with transaction.atomic(), connection().cursor() as cursor:
        closed = _closed_reason(cursor, tid)
        if closed:
            return {'error': closed}
        if active_entry_id(cursor, tid, user_id):
            return {'error': 'You are already on a team in this tournament. Leave it first to create a new one.'}
        entry_id = _insert_entry(cursor, tid, name, captain_id=user_id)
        set_profile(cursor, user_id, looking_for_partner=False)
        return entry_private(fetch_entry(cursor, entry_id), positions(cursor, tid), user_id)


def joinEntry(user_id, data):
    """Join by invite code; the code decides the tournament."""
    code = str(data.get('code') or '').strip().upper()
    with transaction.atomic(), connection().cursor() as cursor:
        found = fetch_entries(cursor, ' WHERE e.invite_code = %s', [code])
        entry = found[0] if found else None
        if entry is None or entry['status'] == WITHDRAWN or entry['captain_id'] is None:
            return {'error': 'That invite code is not valid.', 'fields': {'code': ['That invite code is not valid.']}}
        tid = entry['tournament_id']
        closed = _closed_reason(cursor, tid)
        if closed:
            return {'error': closed}
        if entry['captain_id'] == user_id:
            return {'error': 'You created this team. Send the code to your partner instead.'}
        if entry['partner_id']:
            return {'error': 'This team already has two players.'}
        if active_entry_id(cursor, tid, user_id):
            return {'error': 'You are already on a team in this tournament. Leave it first to join another.'}
        cursor.execute('UPDATE registration_entry SET partner_id = %s WHERE id = %s;', [user_id, entry['id']])
        _confirm(cursor, tid, entry['id'])
        set_profile(cursor, user_id, looking_for_partner=False)
        return entry_private(fetch_entry(cursor, entry['id']), positions(cursor, tid), user_id)


def leaveEntry(tid, user_id, entry_id):
    """The captain withdraws the team; the partner leaves it (the team goes back to forming)."""
    with transaction.atomic(), connection().cursor() as cursor:
        entry = fetch_entry(cursor, entry_id)
        if entry is None or entry['tournament_id'] != tid:
            return {'error': 'Not found.', 'status': 404}
        if load_tournament_by_id(cursor, tid)['drawn_at']:
            return {'error': 'The draw has been made. Please speak to the host to withdraw.'}
        was_confirmed = entry['status'] == CONFIRMED
        if user_id == entry['captain_id']:
            cursor.execute('UPDATE registration_entry SET status = %s WHERE id = %s;', [WITHDRAWN, entry_id])
        elif user_id == entry['partner_id']:
            cursor.execute(
                """
                UPDATE registration_entry SET partner_id = NULL, status = %s, confirmed_at = NULL
                WHERE id = %s;
                """,
                [FORMING, entry_id],
            )
        else:
            return {'error': 'You are not on this team.', 'status': 403}
        if was_confirmed:
            promote_waitlist(cursor, tid)
    return {'ok': True}


# --- Check-in -----------------------------------------------------------------

def _entry_for_ticket(cursor, token):
    """Accept the full ticket UUID (from the QR) or the 8-character code printed under it."""
    token = (token or '').strip()
    if len(token) > 8:
        try:
            value = Entry._meta.get_field('checkin_token').get_db_prep_value(uuid.UUID(token), connection())
        except ValueError:
            return None
        found = fetch_entries(cursor, ' WHERE e.checkin_token = %s AND e.status <> %s', [value, WITHDRAWN])
    else:
        found = fetch_entries(
            cursor,
            " WHERE UPPER(SUBSTR(REPLACE(CAST(e.checkin_token AS TEXT), '-', ''), 1, 8)) = %s AND e.status <> %s",
            [token.upper(), WITHDRAWN],
        )
    return found[0] if found else None


def _ticket(cursor, entry):
    data = entry_public(entry, positions(cursor, entry['tournament_id']))
    data['valid'] = entry['status'] == CONFIRMED
    data['checked_in_at'] = aware(entry['checked_in_at'])
    return data


def ticket_tournament(token):
    """The tournament a ticket belongs to, so the view can check who may scan it in."""
    with connection().cursor() as cursor:
        entry = _entry_for_ticket(cursor, token)
        return load_tournament_by_id(cursor, entry['tournament_id']) if entry else None


def getTicket(token):
    with connection().cursor() as cursor:
        entry = _entry_for_ticket(cursor, token)
        if entry is None:
            return {'error': 'This ticket is not valid.', 'status': 404}
        return _ticket(cursor, entry)


def checkIn(token, is_host):
    with transaction.atomic(), connection().cursor() as cursor:
        entry = _entry_for_ticket(cursor, token)
        if entry is None:
            return {'error': 'This ticket is not valid.', 'status': 404}
        if not is_host:
            return {'error': 'Only the host can check teams in.', 'status': 403}
        if entry['status'] != CONFIRMED:
            return {'error': f'This team is {STATUS_DISPLAY[entry["status"]].lower()}, not confirmed.'}
        if entry['checked_in_at'] is None:
            # Scanning the same ticket twice keeps the first check-in time.
            cursor.execute('UPDATE registration_entry SET checked_in_at = %s WHERE id = %s;', [now(), entry['id']])
            entry = fetch_entry(cursor, entry['id'])
        return _ticket(cursor, entry)


# --- Host ---------------------------------------------------------------------

def addEntry(tid, data, force=False):
    """The host adds a team by name. It takes a spot (or the waitlist) like a registered team."""
    try:
        name = to_text(data.get('name'), 'name', 80, required=True)
        player1 = to_text(data.get('player1'), 'player1', 80)
        player2 = to_text(data.get('player2'), 'player2', 80)
    except Invalid as exc:
        return field_error(exc)
    with transaction.atomic(), connection().cursor() as cursor:
        if load_tournament_by_id(cursor, tid)['drawn_at'] and not force:
            return {'error': 'The draw has been made. Rename an open slot on the Teams tab instead.'}
        entry_id = _insert_entry(cursor, tid, name, player1=player1, player2=player2)
        _confirm(cursor, tid, entry_id)
        place_unplaced(cursor, tid)
        return entry_private(fetch_entry(cursor, entry_id), positions(cursor, tid))


def removeEntry(tid, entry_id, force=False):
    with transaction.atomic(), connection().cursor() as cursor:
        entry = fetch_entry(cursor, entry_id)
        if entry is None or entry['tournament_id'] != tid:
            return {'error': 'Not found.', 'status': 404}
        if load_tournament_by_id(cursor, tid)['drawn_at'] and not force:
            return {'error': 'The draw has been made, so teams can no longer be removed.'}
        cursor.execute('UPDATE registration_entry SET status = %s, slot_id = NULL WHERE id = %s;', [WITHDRAWN, entry_id])
        if entry['slot_id']:
            _fill_slot(cursor, entry['slot_id'], None)
        if entry['status'] == CONFIRMED:
            promote_waitlist(cursor, tid)
        place_unplaced(cursor, tid)
    return {'ok': True}


def getSoloPlayers(tid):
    with connection().cursor() as cursor:
        cursor.execute(
            """
            SELECT u.id, u.username, u.first_name, u.last_name, p.partner_note
            FROM auth_user u JOIN account_profile p ON p.user_id = u.id
            WHERE p.looking_for_partner = %s
              AND NOT EXISTS (
                  SELECT 1 FROM registration_entry e
                  WHERE e.tournament_id = %s AND (e.captain_id = u.id OR e.partner_id = u.id)
                    AND e.status IN (%s, %s, %s)
              )
            ORDER BY u.id;
            """,
            [True, tid, *ACTIVE],
        )
        return [
            {'id': u['id'], 'name': display_name(u['first_name'], u['last_name'], u['username']),
             'username': u['username'], 'note': u['partner_note']}
            for u in rows(cursor)
        ]


def pairPlayers(tid, data, force=False):
    try:
        ids = [int(data.get('user_a')), int(data.get('user_b'))]
    except (TypeError, ValueError):
        return {'error': 'Choose two different players.'}
    with transaction.atomic(), connection().cursor() as cursor:
        cursor.execute('SELECT id, username, first_name FROM auth_user WHERE id IN (%s, %s);', ids)
        users = {u['id']: u for u in rows(cursor)}
        if len(users) != 2:
            return {'error': 'Choose two different players.'}
        if any(active_entry_id(cursor, tid, user_id) for user_id in ids):
            return {'error': 'One of those players is already on a team.'}
        closed = _closed_reason(cursor, tid)
        if closed and not force:
            return {'error': closed}
        a, b = users[ids[0]], users[ids[1]]
        name = str(data.get('name') or '').strip() or f'{a["first_name"] or a["username"]} & {b["first_name"] or b["username"]}'
        entry_id = _insert_entry(cursor, tid, name, captain_id=ids[0], partner_id=ids[1])
        _confirm(cursor, tid, entry_id)
        place_unplaced(cursor, tid)
        for user_id in ids:
            set_profile(cursor, user_id, looking_for_partner=False)
        return entry_private(fetch_entry(cursor, entry_id), positions(cursor, tid))


def _fill_slot(cursor, slot_id, entry, fallback=None):
    """Write a registered team (or the fallback names) into a bracket slot."""
    if entry:
        values = [entry['name'], _captain_name(entry), _partner_name(entry)]
    elif fallback:
        values = [fallback['name'], fallback['player1'], fallback['player2']]
    else:
        values = ['Open slot', '', '']
    cursor.execute('UPDATE teams_team SET name = %s, player1 = %s, player2 = %s WHERE id = %s;', [*values, slot_id])
    if entry:
        cursor.execute('UPDATE registration_entry SET slot_id = %s WHERE id = %s;', [slot_id, entry['id']])


def place_unplaced(cursor, tid, rng=random):
    """After the draw, put confirmed teams that have no slot yet into random open slots."""
    if not load_tournament_by_id(cursor, tid)['drawn_at']:
        return
    waiting = fetch_entries(cursor, ' WHERE e.tournament_id = %s AND e.status = %s AND e.slot_id IS NULL', [tid, CONFIRMED])
    if not waiting:
        return
    cursor.execute(
        """
        SELECT t.id FROM teams_team t
        WHERE t.tournament_id = %s AND t.name = %s
          AND NOT EXISTS (SELECT 1 FROM registration_entry e WHERE e.slot_id = t.id)
        ORDER BY t.bracket, t.seed;
        """,
        [tid, 'Open slot'],
    )
    open_slots = [r[0] for r in cursor.fetchall()]
    rng.shuffle(open_slots)
    for entry, slot_id in zip(waiting, open_slots):
        _fill_slot(cursor, slot_id, entry)


def runDraw(tid, rng=random, force=False):
    """Shuffle confirmed teams into the bracket slots. Empty slots become "Open slot"."""
    with transaction.atomic(), connection().cursor() as cursor:
        if results_exist(cursor, tid) and not force:
            return {'error': 'Scores have already been entered. Reset all results before redrawing.'}
        entries = fetch_entries(cursor, ' WHERE e.tournament_id = %s AND e.status = %s', [tid, CONFIRMED])
        if not entries:
            return {'error': 'There are no confirmed teams to draw yet.'}
        rng.shuffle(entries)

        cursor.execute('UPDATE registration_entry SET slot_id = NULL WHERE tournament_id = %s AND slot_id IS NOT NULL;', [tid])
        cursor.execute('SELECT id FROM teams_team WHERE tournament_id = %s ORDER BY bracket, seed;', [tid])
        for i, (slot_id,) in enumerate(cursor.fetchall()):
            _fill_slot(cursor, slot_id, entries[i] if i < len(entries) else None)

        clear_results(cursor, tid)
        resolve_knockouts(cursor, tid)
        cursor.execute(
            'UPDATE event_tournament SET drawn_at = %s, registration_open = %s WHERE id = %s;', [now(), False, tid]
        )
        return all_teams(cursor, tid)


def swapSlots(tid, data, force=False):
    try:
        ids = [int(data.get('team_a')), int(data.get('team_b'))]
    except (TypeError, ValueError):
        return {'error': 'Choose two different slots.'}
    with transaction.atomic(), connection().cursor() as cursor:
        cursor.execute(
            'SELECT id, name, player1, player2 FROM teams_team WHERE tournament_id = %s AND id IN (%s, %s);', [tid, *ids]
        )
        slots = {t['id']: t for t in rows(cursor)}
        if len(slots) != 2:
            return {'error': 'Choose two different slots.'}
        if results_exist(cursor, tid) and not force:
            return {'error': 'Scores have already been entered, so slots can no longer be swapped.'}
        placed = {e['slot_id']: e for e in fetch_entries(cursor, ' WHERE e.slot_id IN (%s, %s)', ids)}
        cursor.execute('UPDATE registration_entry SET slot_id = NULL WHERE slot_id IN (%s, %s);', ids)
        a, b = ids
        _fill_slot(cursor, a, placed.get(b), fallback=slots[b])
        _fill_slot(cursor, b, placed.get(a), fallback=slots[a])
        return all_teams(cursor, tid)
