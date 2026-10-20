import django.db.models.deletion
from django.db import migrations, models

from core.migration_helpers import assign_tournament


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0001_initial'),
        ('event', '0002_tournaments_and_courts'),
    ]

    operations = [
        migrations.AddField(
            model_name='announcement', name='tournament',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='announcements', to='event.tournament'),
        ),
        migrations.RunPython(assign_tournament('announcements', 'announcement'), migrations.RunPython.noop),
        migrations.AlterField(
            model_name='announcement', name='tournament',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='announcements', to='event.tournament'),
        ),
    ]
