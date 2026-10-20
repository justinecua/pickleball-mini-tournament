import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
from django.utils.text import slugify


def tournaments_and_courts(apps, schema_editor):
    """Give the existing event a slug and host, and turn its court count and venue into Court rows."""
    Tournament = apps.get_model('event', 'Tournament')
    Court = apps.get_model('event', 'Court')
    TimelineEvent = apps.get_model('event', 'TimelineEvent')
    User = apps.get_model('auth', 'User')
    host = User.objects.filter(is_superuser=True).order_by('id').first() or User.objects.filter(is_staff=True).order_by('id').first()
    taken = set()
    for t in Tournament.objects.order_by('id'):
        base = slugify(t.name)[:70] or 'tournament'
        slug, n = base, 2
        while slug in taken:
            slug, n = f'{base}-{n}', n + 1
        taken.add(slug)
        t.slug = slug
        t.host = t.host or host
        t.save(update_fields=['slug', 'host'])
        for number in range(1, max(1, min(t.court_count, 8)) + 1):
            Court.objects.create(tournament=t, number=number, venue_name=t.venue)
    if TimelineEvent.objects.exists():
        first = Tournament.objects.order_by('id').first()
        if first is None:
            first = Tournament.objects.create(slug='pickleball-mini-tournament', host=host)
            Court.objects.bulk_create([Court(tournament=first, number=n) for n in range(1, 5)])
        TimelineEvent.objects.filter(tournament__isnull=True).update(tournament=first)


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameModel('TournamentInfo', 'Tournament'),
        migrations.AlterModelOptions(name='tournament', options={'ordering': ['-date', '-created_at']}),
        # The old court count would clash with the new Court relation's `courts` name.
        migrations.RenameField('tournament', 'courts', 'court_count'),
        migrations.AddField(
            model_name='tournament', name='host',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='hosted_tournaments', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(model_name='tournament', name='slug', field=models.SlugField(max_length=80, null=True)),
        migrations.AddField(model_name='tournament', name='teams_per_bracket', field=models.PositiveSmallIntegerField(default=4)),
        migrations.AddField(model_name='tournament', name='created_at', field=models.DateTimeField(default=django.utils.timezone.now)),
        migrations.CreateModel(
            name='Court',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('number', models.PositiveSmallIntegerField()),
                ('venue_name', models.CharField(blank=True, max_length=120)),
                ('address', models.CharField(blank=True, max_length=240)),
                ('tournament', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='courts', to='event.tournament')),
            ],
            options={
                'ordering': ['tournament', 'number'],
                'constraints': [models.UniqueConstraint(fields=('tournament', 'number'), name='unique_tournament_court')],
            },
        ),
        migrations.AddField(
            model_name='timelineevent', name='tournament',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='timeline', to='event.tournament'),
        ),
        migrations.RunPython(tournaments_and_courts, migrations.RunPython.noop),
        migrations.RemoveField(model_name='tournament', name='court_count'),
        migrations.RemoveField(model_name='tournament', name='venue'),
        migrations.AlterField(model_name='tournament', name='slug', field=models.SlugField(max_length=80, unique=True)),
        migrations.AlterField(
            model_name='timelineevent', name='tournament',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='timeline', to='event.tournament'),
        ),
    ]
