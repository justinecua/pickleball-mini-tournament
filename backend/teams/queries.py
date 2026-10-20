"""
Bracket slots (A1, A2, ... one bracket per court). The draw
(registration/queries.py) writes registered teams into these rows; hosts can
rename teams and players here.

  team_dict(row, prefix)   - the JSON shape used everywhere a team appears
  getTeams(tid) / getTeam(tid, id) / updateTeam(tid, id, data)

Example:
    updateTeam(1, 3, {"name": "Kitchen Kings", "player1": "Maya"})
    -> {"id": 3, "code": "A3", "name": "Kitchen Kings", ...}
"""

from core.db import Invalid, connection, field_error, row, rows, to_text

TEAM_COLUMNS = 'id, name, player1, player2, bracket, seed'


def team_dict(data, prefix=''):
    """Build a team from a row dict; `prefix` reads aliased join columns (e.g. "t1_")."""
    team_id = data.get(f'{prefix}id')
    if team_id is None:
        return None
    bracket, seed = data[f'{prefix}bracket'], data[f'{prefix}seed']
    return {
        'id': team_id,
        'code': f'{bracket}{seed}',
        'name': data[f'{prefix}name'],
        'player1': data[f'{prefix}player1'],
        'player2': data[f'{prefix}player2'],
        'bracket': bracket,
        'seed': seed,
    }


def fetch_team(cursor, tid, team_id):
    if team_id is None:
        return None
    cursor.execute(f'SELECT {TEAM_COLUMNS} FROM teams_team WHERE id = %s AND tournament_id = %s;', [team_id, tid])
    found = row(cursor)
    return team_dict(found) if found else None


def all_teams(cursor, tid):
    cursor.execute(f'SELECT {TEAM_COLUMNS} FROM teams_team WHERE tournament_id = %s ORDER BY bracket, seed;', [tid])
    return [team_dict(r) for r in rows(cursor)]


def getTeams(tid):
    with connection().cursor() as cursor:
        return all_teams(cursor, tid)


def getTeam(tid, team_id):
    with connection().cursor() as cursor:
        team = fetch_team(cursor, tid, team_id)
    return team or {'error': 'Not found.', 'status': 404}


def updateTeam(tid, team_id, data):
    try:
        changes = {}
        if 'name' in data:
            changes['name'] = to_text(data['name'], 'name', 80, required=True)
        for field in ('player1', 'player2'):
            if field in data:
                changes[field] = to_text(data[field], field, 80)
    except Invalid as exc:
        return field_error(exc)

    with connection().cursor() as cursor:
        if fetch_team(cursor, tid, team_id) is None:
            return {'error': 'Not found.', 'status': 404}
        if changes:
            assignments = ', '.join(f'{field} = %s' for field in changes)
            cursor.execute(f'UPDATE teams_team SET {assignments} WHERE id = %s;', [*changes.values(), team_id])
        return fetch_team(cursor, tid, team_id)
