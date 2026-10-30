from django.db import migrations


def reschedule(apps, schema_editor):
    """Round-robin games used to run one bracket per court, so a team could play twice in a row.
    Brackets now share a pair of courts and take turns a round at a time (A1 v A2, A3 v A4, then
    B1 v B2, B3 v B4 ...). Moves each game to its new court and slot; games, teams and codes stay.
    Tournaments that have round-robin scores are left alone."""
    from event.schedule import plan

    Tournament = apps.get_model('event', 'Tournament')
    Court = apps.get_model('event', 'Court')
    Match = apps.get_model('matches', 'Match')

    for t in Tournament.objects.all():
        games = Match.objects.filter(tournament=t, stage='RR')
        if not games.exists() or games.filter(score1__isnull=False).exists():
            continue
        courts = Court.objects.filter(tournament=t).count()
        matches, _ = plan(courts, t.teams_per_bracket, t.start_time, t.game_minutes)
        for m in matches:
            if m['stage'] == 'RR':
                games.filter(code=m['code']).update(court=m['court'], start_time=m['start'].time(), end_time=m['end'].time())


class Migration(migrations.Migration):

    dependencies = [
        ('matches', '0003_reorder_crossover_playoffs'),
    ]

    operations = [
        migrations.RunPython(reschedule, migrations.RunPython.noop),
    ]
