import django.db.models.deletion
from django.db import migrations, models

from core.migration_helpers import assign_tournament


class Migration(migrations.Migration):

    dependencies = [
        ('matches', '0001_initial'),
        ('event', '0002_tournaments_and_courts'),
    ]

    operations = [
        migrations.AddField(
            model_name='match', name='tournament',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='matches', to='event.tournament'),
        ),
        migrations.RunPython(assign_tournament('matches', 'match'), migrations.RunPython.noop),
        migrations.AlterField(
            model_name='match', name='tournament',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='matches', to='event.tournament'),
        ),
        migrations.AlterField(model_name='match', name='code', field=models.CharField(max_length=10)),
        migrations.AlterField(
            model_name='match', name='stage',
            field=models.CharField(choices=[('RR', 'Round Robin'), ('R16', 'Round of 16'), ('QF', 'Quarterfinal'), ('SF', 'Semifinal'), ('3P', 'Third Place'), ('F', 'Championship')], max_length=3),
        ),
        migrations.AlterModelOptions(name='match', options={'ordering': ['tournament', 'start_time', 'court'], 'verbose_name_plural': 'matches'}),
        migrations.AddConstraint(
            model_name='match',
            constraint=models.UniqueConstraint(fields=('tournament', 'code'), name='unique_tournament_match_code'),
        ),
    ]
