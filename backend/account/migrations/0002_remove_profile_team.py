from django.db import migrations


class Migration(migrations.Migration):
    """A player's team is now looked up per tournament from their registration."""

    dependencies = [
        ('account', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(model_name='profile', name='team'),
    ]
