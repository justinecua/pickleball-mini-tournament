import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

from core.migration_helpers import assign_tournament


class Migration(migrations.Migration):

    dependencies = [
        ('registration', '0001_initial'),
        ('event', '0002_tournaments_and_courts'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='entry', name='tournament',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='entries', to='event.tournament'),
        ),
        migrations.RunPython(assign_tournament('registration', 'entry'), migrations.RunPython.noop),
        migrations.AlterField(
            model_name='entry', name='tournament',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entries', to='event.tournament'),
        ),
        migrations.AlterField(
            model_name='entry', name='captain',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='captained_entries', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(model_name='entry', name='player1', field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name='entry', name='player2', field=models.CharField(blank=True, max_length=80)),
    ]
