"""
A tournament's games: scores, bracket standings and playoff advancement.

  - Standings rank by wins, then point difference, then points scored, then seed.
  - When a bracket's round-robin games are all final, its qualifiers fill their
    playoff slots ("A1" = 1st in bracket A). Overall seeds ("S3") fill once every
    bracket is final: bracket winners first, then the best runners-up.
    Winners and losers then flow on ("W:QF1", "L:SF2").
  - Changing an earlier result re-pairs later rounds and clears any result
    that no longer applies.

Example:
    updateMatch(1, 7, {"score1": 11, "score2": 7, "status": "completed"})
    -> {"id": 7, "code": "RR-A-1", "score1": 11, ..., "winner_id": 1}
"""

from django.db import transaction

from core.db import Invalid, connection, db_time, field_error, rows, to_int
from event.schedule import advancement, bracket_letters, playoff_size
from teams.queries import team_dict

from .models import Match

STAGE_DISPLAY = dict(Match.STAGES)
STATUSES = dict(Match.STATUSES)

MATCH_SELECT = """
    SELECT m.id, m.code, m.stage, m.label, m.bracket, m.match_no, m.court,
           m.start_time, m.end_time, m.team1_source, m.team2_source,
           m.team1_id, m.team2_id, m.score1, m.score2, m.status,
           t1.id AS t1_id, t1.name AS t1_name, t1.player1 AS t1_player1, t1.player2 AS t1_player2,
           t1.bracket AS t1_bracket, t1.seed AS t1_seed,
           t2.id AS t2_id, t2.name AS t2_name, t2.player1 AS t2_player1, t2.player2 AS t2_player2,
           t2.bracket AS t2_bracket, t2.seed AS t2_seed
    FROM matches_match m
    LEFT JOIN teams_team t1 ON t1.id = m.team1_id
    LEFT JOIN teams_team t2 ON t2.id = m.team2_id
    WHERE m.tournament_id = %s
"""
ORDER = ' ORDER BY m.start_time, m.court'


def _winner_id(m):
    if m['status'] != Match.COMPLETED or m['score1'] is None or m['score2'] is None:
        return None
    return m['team1_id'] if m['score1'] > m['score2'] else m['team2_id']


def _loser_id(m):
    winner = _winner_id(m)
    if winner is None:
        return None
    return m['team2_id'] if winner == m['team1_id'] else m['team1_id']


def match_dict(m):
    return {
        'id': m['id'],
        'code': m['code'],
        'stage': m['stage'],
        'stage_display': STAGE_DISPLAY.get(m['stage'], m['stage']),
        'label': m['label'],
        'bracket': m['bracket'],
        'match_no': m['match_no'],
        'court': m['court'],
        'start_time': m['start_time'],
        'end_time': m['end_time'],
        'team1_source': m['team1_source'],
        'team2_source': m['team2_source'],
        'team1': team_dict(m, 't1_'),
        'team2': team_dict(m, 't2_'),
        'score1': m['score1'],
        'score2': m['score2'],
        'status': m['status'],
        'winner_id': _winner_id(m),
    }


def fetch_matches(cursor, tid, where='', params=()):
    cursor.execute(MATCH_SELECT + where + ORDER + ';', [tid, *params])
    return rows(cursor)


def fetch_match(cursor, tid, match_id):
    found = fetch_matches(cursor, tid, ' AND m.id = %s', [match_id])
    return found[0] if found else None


def court_count(cursor, tid):
    cursor.execute('SELECT COUNT(*) FROM event_court WHERE tournament_id = %s;', [tid])
    return cursor.fetchone()[0]


# --- Standings ----------------------------------------------------------------

def _rank_key(r):
    return -r['wins'], -(r['points_for'] - r['points_against']), -r['points_for']


def bracket_standings(cursor, tid, bracket):
    cursor.execute(
        'SELECT id, name, player1, player2, bracket, seed FROM teams_team WHERE tournament_id = %s AND bracket = %s;',
        [tid, bracket],
    )
    table = {
        t['id']: {'team': team_dict(t), 'seed': t['seed'], 'played': 0, 'wins': 0, 'losses': 0,
                  'points_for': 0, 'points_against': 0}
        for t in rows(cursor)
    }
    cursor.execute(
        """
        SELECT team1_id, team2_id, score1, score2 FROM matches_match
        WHERE tournament_id = %s AND stage = %s AND bracket = %s AND status = %s;
        """,
        [tid, Match.ROUND_ROBIN, bracket, Match.COMPLETED],
    )
    for m in rows(cursor):
        if m['team1_id'] not in table or m['team2_id'] not in table:
            continue
        for team_id, own, other in ((m['team1_id'], m['score1'], m['score2']), (m['team2_id'], m['score2'], m['score1'])):
            entry = table[team_id]
            entry['played'] += 1
            entry['points_for'] += own
            entry['points_against'] += other
            entry['wins' if own > other else 'losses'] += 1

    ranked = sorted(table.values(), key=lambda r: (*_rank_key(r), r['seed']))
    for rank, entry in enumerate(ranked, start=1):
        entry['rank'] = rank
        entry['diff'] = entry['points_for'] - entry['points_against']
        del entry['seed']
    return ranked


def bracket_complete(cursor, tid, bracket):
    cursor.execute(
        """
        SELECT COUNT(*), SUM(CASE WHEN status = %s THEN 1 ELSE 0 END)
        FROM matches_match WHERE tournament_id = %s AND stage = %s AND bracket = %s;
        """,
        [Match.COMPLETED, tid, Match.ROUND_ROBIN, bracket],
    )
    total, done = cursor.fetchone()
    return bool(total) and total == done


def overall_seeds(tables, courts):
    """Playoff seeds when brackets don't pair off: winners by record, then the best runners-up."""
    winners = [t[0] for t in tables.values() if t]
    runners_up = [t[1] for t in tables.values() if len(t) > 1]
    by_record = lambda r: (*_rank_key(r), r['team']['bracket'])  # noqa: E731
    seeds = sorted(winners, key=by_record) + sorted(runners_up, key=by_record)
    return [r['team']['id'] for r in seeds[:playoff_size(courts)]]


def getStandings(tid):
    with connection().cursor() as cursor:
        courts = court_count(cursor, tid)
        per_bracket, wildcards = advancement(courts)
        brackets = {
            bracket: {'court': court, 'complete': bracket_complete(cursor, tid, bracket),
                      'rows': bracket_standings(cursor, tid, bracket)}
            for court, bracket in enumerate(bracket_letters(courts), start=1)
        }
        if wildcards and all(b['complete'] for b in brackets.values()):
            seeded = set(overall_seeds({k: b['rows'] for k, b in brackets.items()}, courts))
            for b in brackets.values():
                for r in b['rows']:
                    r['qualified'] = r['team']['id'] in seeded
        return {'per_bracket': per_bracket, 'wildcards': wildcards, 'brackets': brackets}


# --- Advancement --------------------------------------------------------------

def resolve_knockouts(cursor, tid):
    """Fill playoff slots from standings and results; clear results that no longer apply."""
    courts = court_count(cursor, tid)
    tables = {}
    seeds = None
    by_code = {}

    def table(bracket):
        if bracket not in tables:
            tables[bracket] = bracket_standings(cursor, tid, bracket) if bracket_complete(cursor, tid, bracket) else None
        return tables[bracket]

    def resolve(source):
        nonlocal seeds
        if not source:
            return None
        if ':' in source:
            kind, code = source.split(':', 1)
            previous = by_code.get(code)
            if previous is None:
                return None
            return _winner_id(previous) if kind == 'W' else _loser_id(previous)
        if source[0] == 'S':
            if seeds is None:
                complete = {b: table(b) for b in bracket_letters(courts)}
                seeds = overall_seeds(complete, courts) if all(complete.values()) else []
            place = int(source[1:])
            return seeds[place - 1] if len(seeds) >= place else None
        found = table(source[0])
        place = int(source[1:])
        if not found or len(found) < place:
            return None
        return found[place - 1]['team']['id']

    for m in fetch_matches(cursor, tid, ' AND m.stage <> %s', [Match.ROUND_ROBIN]):
        team1, team2 = resolve(m['team1_source']), resolve(m['team2_source'])
        if team1 != m['team1_id'] or team2 != m['team2_id']:
            # The pairing changed, so any previous result is invalid.
            cursor.execute(
                """
                UPDATE matches_match
                SET team1_id = %s, team2_id = %s, score1 = NULL, score2 = NULL, status = %s
                WHERE id = %s;
                """,
                [team1, team2, Match.SCHEDULED, m['id']],
            )
            m.update(team1_id=team1, team2_id=team2, score1=None, score2=None, status=Match.SCHEDULED)
        by_code[m['code']] = m


def placements(cursor, tid):
    found = {m['code']: m for m in fetch_matches(cursor, tid, ' AND m.code IN (%s, %s)', ['F', '3P'])}
    final, third = found.get('F'), found.get('3P')

    def side(m, team_id):
        if m is None or team_id is None:
            return None
        return team_dict(m, 't1_') if team_id == m['team1_id'] else team_dict(m, 't2_')

    return {
        'champion': side(final, final and _winner_id(final)),
        'runner_up': side(final, final and _loser_id(final)),
        'third_place': side(third, third and _winner_id(third)),
    }


def results_exist(cursor, tid):
    cursor.execute('SELECT COUNT(*) FROM matches_match WHERE tournament_id = %s AND status <> %s;', [tid, Match.SCHEDULED])
    return cursor.fetchone()[0] > 0


def clear_results(cursor, tid):
    cursor.execute(
        'UPDATE matches_match SET score1 = NULL, score2 = NULL, status = %s WHERE tournament_id = %s;',
        [Match.SCHEDULED, tid],
    )
    cursor.execute(
        'UPDATE matches_match SET team1_id = NULL, team2_id = NULL WHERE tournament_id = %s AND stage <> %s;',
        [tid, Match.ROUND_ROBIN],
    )


def match_summary(cursor, tid):
    """Progress, live matches and the next time slot, for the overview."""
    cursor.execute(
        'SELECT COUNT(*), SUM(CASE WHEN status = %s THEN 1 ELSE 0 END) FROM matches_match WHERE tournament_id = %s;',
        [Match.COMPLETED, tid],
    )
    total, completed = cursor.fetchone()
    live = fetch_matches(cursor, tid, ' AND m.status = %s', [Match.LIVE])
    cursor.execute(
        """
        SELECT start_time FROM matches_match WHERE tournament_id = %s AND status <> %s
        ORDER BY start_time, court LIMIT 1;
        """,
        [tid, Match.COMPLETED],
    )
    next_slot = cursor.fetchone()
    up_next = []
    if next_slot:
        up_next = fetch_matches(cursor, tid, ' AND m.start_time = %s AND m.status <> %s', [db_time(next_slot[0]), Match.COMPLETED])
    return {
        'total_matches': total,
        'completed_matches': completed or 0,
        'live': [match_dict(m) for m in live],
        'up_next': [match_dict(m) for m in up_next],
    }


# --- Endpoints ----------------------------------------------------------------

def getMatches(tid, stage=None):
    with connection().cursor() as cursor:
        found = fetch_matches(cursor, tid, ' AND m.stage = %s', [stage]) if stage else fetch_matches(cursor, tid)
        return [match_dict(m) for m in found]


def getMatch(tid, match_id):
    with connection().cursor() as cursor:
        m = fetch_match(cursor, tid, match_id)
    return match_dict(m) if m else {'error': 'Not found.', 'status': 404}


def updateMatch(tid, match_id, data):
    try:
        status = data.get('status')
        if status is not None and status not in STATUSES:
            raise Invalid('status', f'"{status}" is not a valid choice.')
        scores = {key: to_int(data[key], key, minimum=0) for key in ('score1', 'score2') if key in data}
    except Invalid as exc:
        return field_error(exc)

    with transaction.atomic(), connection().cursor() as cursor:
        current = fetch_match(cursor, tid, match_id)
        if current is None:
            return {'error': 'Not found.', 'status': 404}
        status = status or current['status']
        score1 = scores.get('score1', current['score1'])
        score2 = scores.get('score2', current['score2'])
        if status != Match.SCHEDULED and (current['team1_id'] is None or current['team2_id'] is None):
            return {'error': 'Both teams must be decided before this match can be played.'}
        if status == Match.COMPLETED:
            if score1 is None or score2 is None:
                return {'error': 'Enter both scores to complete the match.'}
            if score1 == score2:
                return {'error': 'Pickleball games cannot end in a tie.'}

        cursor.execute(
            'UPDATE matches_match SET score1 = %s, score2 = %s, status = %s WHERE id = %s;',
            [score1, score2, status, match_id],
        )
        resolve_knockouts(cursor, tid)
        return match_dict(fetch_match(cursor, tid, match_id))


def resetMatch(tid, match_id):
    with transaction.atomic(), connection().cursor() as cursor:
        if fetch_match(cursor, tid, match_id) is None:
            return {'error': 'Not found.', 'status': 404}
        cursor.execute(
            'UPDATE matches_match SET score1 = NULL, score2 = NULL, status = %s WHERE id = %s;',
            [Match.SCHEDULED, match_id],
        )
        resolve_knockouts(cursor, tid)
        return match_dict(fetch_match(cursor, tid, match_id))


def resetResults(tid):
    with transaction.atomic(), connection().cursor() as cursor:
        clear_results(cursor, tid)
    return {'ok': True}
