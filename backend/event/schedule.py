"""
Builds a tournament's bracket slots, games and run of show from its settings.

The format is one bracket per court (A, B, C ... up to H):
  - Brackets pair up on a pair of courts (A and B on courts 1-2, C and D on 3-4 ...)
    and take turns a round at a time, so nobody plays two games in a row. With an
    odd number of courts the last bracket has the last court to itself.
  - Every team plays every other team in its bracket.
  - Playoffs are single elimination. With 1, 2, 4 or 8 brackets the top two of
    each bracket go through and cross over (QF1 A1 v B2, QF2 C1 v D2, QF3 B1 v A2,
    QF4 D1 v C2). Otherwise
    every bracket winner goes through, plus the best runners-up needed to fill
    a bracket of 4 or 8, seeded overall ("S1" = best bracket winner).
  - A third-place game is played alongside the final whenever there are semis.

Example:
    knockout_rounds(4)
    -> [('QF', [('QF1', 'QF 1', 'A1', 'B2'), ...]), ('SF', [...]), ('F', [('F', ...), ('3P', ...)])]
"""

from datetime import date, datetime, timedelta

LETTERS = 'ABCDEFGH'
MAX_COURTS = len(LETTERS)
TEAMS_PER_BRACKET = (3, 6)
BREAK_MINUTES = 10
AWARDS_MINUTES = 20

ROUND_STAGE = {8: 'R16', 4: 'QF', 2: 'SF', 1: 'F'}
ROUND_NAME = {'R16': 'Round of 16', 'QF': 'Quarterfinals', 'SF': 'Semifinals', 'F': 'Finals'}


def bracket_letters(courts):
    return LETTERS[:courts]


def _power_of_two(n):
    return n & (n - 1) == 0


def playoff_size(courts):
    """How many teams reach the playoffs: 2 per bracket, trimmed down to a power of two."""
    return 1 << ((2 * courts).bit_length() - 1)


def advancement(courts):
    """(places per bracket that go through, extra wildcard places for the best runners-up)."""
    if _power_of_two(courts):
        return 2, 0
    return 1, playoff_size(courts) - courts


def bracket_courts(courts):
    """{bracket: [court numbers]}: 4 courts -> {'A': [1, 2], 'B': [1, 2], 'C': [3, 4], 'D': [3, 4]}."""
    out = {}
    for i, bracket in enumerate(bracket_letters(courts)):
        first = i - i % 2 + 1
        out[bracket] = [first] if first == courts else [first, first + 1]
    return out


def round_robin_rounds(teams):
    """Every pairing of seeds 1..teams, in rounds where each team plays at most once (circle method).
    4 teams -> [[(1, 2), (3, 4)], [(1, 3), (2, 4)], [(1, 4), (2, 3)]]."""
    seeds = list(range(1, teams + 1)) + ([None] if teams % 2 else [])
    fixed, rest = seeds[0], seeds[1:]
    rounds = []
    for _ in range(len(rest)):
        round_pairs = [(fixed, rest[0])] + [(rest[i], rest[-i]) for i in range(1, len(rest) // 2 + 1)]
        rounds.append([tuple(sorted(p)) for p in round_pairs if None not in p])
        rest = rest[1:] + rest[:1]
    return rounds


def _seed_order(size):
    """Bracket order that keeps top seeds apart until the end: 4 -> [1, 4, 2, 3]."""
    order = [1, 2]
    while len(order) < size:
        order = [x for seed in order for x in (seed, 2 * len(order) + 1 - seed)]
    return order


def knockout_rounds(courts):
    """[(stage, [(code, label, team1_source, team2_source), ...]), ...] from the first playoff round to the final."""
    letters = bracket_letters(courts)
    if courts == 1:
        sources = [('A1', 'A2')]
    elif _power_of_two(courts):
        # All the "A1 v B2" games fill the top half, their "B1 v A2" twins the bottom half,
        # so two winners of paired brackets can only meet in the final.
        pairs = list(zip(letters[::2], letters[1::2]))
        sources = [(f'{a}1', f'{b}2') for a, b in pairs] + [(f'{b}1', f'{a}2') for a, b in pairs]
    else:
        order = _seed_order(playoff_size(courts))
        sources = [(f'S{order[i]}', f'S{order[i + 1]}') for i in range(0, len(order), 2)]

    rounds = []
    while True:
        stage = ROUND_STAGE[len(sources)]
        if stage == 'F':
            matches = [('F', 'Championship', *sources[0])]
            if rounds and rounds[-1][0] == 'SF':
                matches.append(('3P', 'Third Place', 'L:SF1', 'L:SF2'))
            rounds.append((stage, matches))
            return rounds
        prefix = 'R16-' if stage == 'R16' else stage
        codes = [f'{prefix}{i}' for i in range(1, len(sources) + 1)]
        label = 'R16' if stage == 'R16' else stage
        rounds.append((stage, [(code, f'{label} {i}', *src) for i, (code, src) in enumerate(zip(codes, sources), start=1)]))
        sources = [(f'W:{codes[i]}', f'W:{codes[i + 1]}') for i in range(0, len(codes), 2)]


def plan(courts, teams_per_bracket, start_time, game_minutes):
    """Every game and run-of-show row, with times. Pure data; build() writes it to the database."""
    game = timedelta(minutes=game_minutes)
    clock = datetime.combine(date(2000, 1, 1), start_time)
    rounds, match_no = [], 0
    for pairs in round_robin_rounds(teams_per_bracket):
        rounds.append([(match_no + i, *p) for i, p in enumerate(pairs, start=1)])
        match_no += len(pairs)
    sharing = {}
    for bracket, numbers in bracket_courts(courts).items():
        sharing.setdefault(tuple(numbers), []).append(bracket)

    matches, slots = [], 0
    for numbers, brackets in sharing.items():
        # A1 v A2, A3 v A4 | B1 v B2, B3 v B4 | A1 v A3 ...: brackets sharing courts take turns a round at a time.
        games = [(bracket, *g) for pairs in rounds for bracket in brackets for g in pairs]
        for i, (bracket, match_no, s1, s2) in enumerate(games):
            start = clock + game * (i // len(numbers))
            matches.append({
                'code': f'RR-{bracket}-{match_no}', 'stage': 'RR', 'label': f'Bracket {bracket} · Match {match_no}',
                'bracket': bracket, 'match_no': match_no, 'court': numbers[i % len(numbers)],
                'start': start, 'end': start + game,
                'team1_source': f'{bracket}{s1}', 'team2_source': f'{bracket}{s2}',
            })
        slots = max(slots, -(-len(games) // len(numbers)))
    rr_end = clock + game * slots
    per_bracket, wildcards = advancement(courts)
    timeline = [
        (clock, rr_end, 'Round robin', courts * match_no,
         f'{match_no} games per bracket, {courts} court{"s" if courts > 1 else ""}'),
        (rr_end, rr_end + timedelta(minutes=BREAK_MINUTES), 'Verify standings and prepare', None,
         f'Top {per_bracket} per bracket advance' + (f' + {wildcards} best runner{"s" if wildcards > 1 else ""}-up' if wildcards else '')),
    ]

    start = rr_end + timedelta(minutes=BREAK_MINUTES)
    match_no = 0
    for stage, games in knockout_rounds(courts):
        end = start + game
        for court, (code, label, src1, src2) in enumerate(games, start=1):
            match_no += 1
            matches.append({
                'code': code, 'stage': '3P' if code == '3P' else stage, 'label': label, 'bracket': '',
                'match_no': match_no, 'court': court, 'start': start, 'end': end,
                'team1_source': src1, 'team2_source': src2,
            })
        if stage == 'F':
            activity = 'Championship and third place' if len(games) > 1 else 'Championship'
            details = 'Courts 1 & 2' if len(games) > 1 else 'Court 1'
        else:
            activity = ROUND_NAME[stage]
            details = '1 game per court' if len(games) == courts else f'Courts 1–{len(games)}'
        timeline.append((start, end, activity, len(games), details))
        start = end
    timeline.append((start, start + timedelta(minutes=AWARDS_MINUTES), 'Awards and photos', None, 'Announce winners'))
    return matches, timeline


def build(tournament_id):
    """Replace a tournament's slots, games and run of show with a fresh set from its settings.
    Clears the draw: registered teams are unplaced and need drawing again."""
    from matches.models import Match
    from registration.models import Entry
    from teams.models import Team

    from .models import Court, TimelineEvent, Tournament

    t = Tournament.objects.get(pk=tournament_id)
    courts = Court.objects.filter(tournament=t).count()
    Entry.objects.filter(tournament=t, slot__isnull=False).update(slot=None)
    Match.objects.filter(tournament=t).delete()
    Team.objects.filter(tournament=t).delete()
    TimelineEvent.objects.filter(tournament=t).delete()
    Tournament.objects.filter(pk=t.pk).update(drawn_at=None)

    teams = {}
    for bracket in bracket_letters(courts):
        for seed in range(1, t.teams_per_bracket + 1):
            teams[f'{bracket}{seed}'] = Team.objects.create(
                tournament=t, bracket=bracket, seed=seed, name=f'Team {bracket}{seed}',
            )

    matches, timeline = plan(courts, t.teams_per_bracket, _as_time(t.start_time), t.game_minutes)
    Match.objects.bulk_create([
        Match(
            tournament=t, code=m['code'], stage=m['stage'], label=m['label'], bracket=m['bracket'],
            match_no=m['match_no'], court=m['court'], start_time=m['start'].time(), end_time=m['end'].time(),
            team1_source=m['team1_source'], team2_source=m['team2_source'],
            team1=teams.get(m['team1_source']) if m['stage'] == 'RR' else None,
            team2=teams.get(m['team2_source']) if m['stage'] == 'RR' else None,
        )
        for m in matches
    ])
    _write_timeline(t, timeline)


def retime(tournament_id):
    """Move every game to the court and slot the current settings give it, keeping results."""
    from matches.models import Match

    from .models import Court, Tournament

    t = Tournament.objects.get(pk=tournament_id)
    courts = Court.objects.filter(tournament=t).count()
    matches, timeline = plan(courts, t.teams_per_bracket, _as_time(t.start_time), t.game_minutes)
    for m in matches:
        Match.objects.filter(tournament=t, code=m['code']).update(
            court=m['court'], start_time=m['start'].time(), end_time=m['end'].time())
    _write_timeline(t, timeline)


def _write_timeline(t, timeline):
    from .models import TimelineEvent

    TimelineEvent.objects.filter(tournament=t).delete()
    TimelineEvent.objects.bulk_create([
        TimelineEvent(tournament=t, order=order, start_time=start.time(), end_time=end.time(),
                      activity=activity, games=games, details=details)
        for order, (start, end, activity, games, details) in enumerate(timeline, start=1)
    ])


def _as_time(value):
    if isinstance(value, str):
        return datetime.strptime(value[:5], '%H:%M').time()
    return value
