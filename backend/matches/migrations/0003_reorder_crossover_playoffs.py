from django.db import migrations

LETTERS = 'ABCDEFGH'


def reorder(apps, schema_editor):
    """Cross-over playoffs used to run A1 v B2, B1 v A2, C1 v D2 ...; they now run every "1st v 2nd"
    of the paired brackets first (QF1 A1 v B2, QF2 C1 v D2, QF3 B1 v A2, QF4 D1 v C2).
    Moves each pairing, with any teams already placed in it, to its new game. Tournaments
    that have playoff scores are left alone."""
    Tournament = apps.get_model('event', 'Tournament')
    Court = apps.get_model('event', 'Court')
    Match = apps.get_model('matches', 'Match')

    for t in Tournament.objects.all():
        courts = Court.objects.filter(tournament=t).count()
        if courts < 4 or courts & (courts - 1):
            continue  # 1-2 courts have nothing to reorder; other sizes seed overall ("S1")
        playoffs = Match.objects.filter(tournament=t).exclude(stage='RR')
        if playoffs.filter(score1__isnull=False).exists():
            continue
        stage = 'R16' if courts == 8 else 'QF'
        games = list(Match.objects.filter(tournament=t, stage=stage).order_by('match_no'))
        pairs = list(zip(LETTERS[:courts:2], LETTERS[1:courts:2]))
        wanted = [(f'{a}1', f'{b}2') for a, b in pairs] + [(f'{b}1', f'{a}2') for a, b in pairs]
        placed = {(g.team1_source, g.team2_source): (g.team1_id, g.team2_id) for g in games}
        if len(games) != len(wanted) or set(placed) != set(wanted):
            continue
        for game, sources in zip(games, wanted):
            game.team1_source, game.team2_source = sources
            game.team1_id, game.team2_id = placed[sources]
            game.save(update_fields=['team1_source', 'team2_source', 'team1', 'team2'])


class Migration(migrations.Migration):

    dependencies = [
        ('matches', '0002_match_tournament'),
        ('event', '0002_tournaments_and_courts'),
    ]

    operations = [
        migrations.RunPython(reorder, migrations.RunPython.noop),
    ]
