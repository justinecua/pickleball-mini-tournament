import django.db.models.deletion
from django.db import migrations, models

from core.migration_helpers import assign_tournament


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0001_initial'),
        ('event', '0002_tournaments_and_courts'),
    ]

    operations = [
        migrations.RemoveConstraint(model_name='team', name='unique_bracket_seed'),
        migrations.AddField(
            model_name='team', name='tournament',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='event.tournament'),
        ),
        migrations.RunPython(assign_tournament('teams', 'team'), migrations.RunPython.noop),
        migrations.AlterField(
            model_name='team', name='tournament',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='event.tournament'),
        ),
        migrations.AlterField(
            model_name='team', name='bracket',
            field=models.CharField(choices=[('A', 'Bracket A'), ('B', 'Bracket B'), ('C', 'Bracket C'), ('D', 'Bracket D'), ('E', 'Bracket E'), ('F', 'Bracket F'), ('G', 'Bracket G'), ('H', 'Bracket H')], max_length=1),
        ),
        migrations.AlterModelOptions(name='team', options={'ordering': ['tournament', 'bracket', 'seed']}),
        migrations.AddConstraint(
            model_name='team',
            constraint=models.UniqueConstraint(fields=('tournament', 'bracket', 'seed'), name='unique_tournament_bracket_seed'),
        ),
    ]
