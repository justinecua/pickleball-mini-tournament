"""Create a demo tournament: 4 courts, 16 teams, the 32-game schedule and the run of show."""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from event import schedule
from event.models import Court, Tournament
from matches.models import Match
from teams.models import Team

SLUG = 'pickleball-mini-tournament'


class Command(BaseCommand):
    help = 'Seed a demo tournament (4 courts, 4 teams per bracket).'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Rebuild the demo tournament from scratch.')
        parser.add_argument('--host', help='Username of the host (defaults to the first admin).')
        parser.add_argument('--slug', default=SLUG)

    @transaction.atomic
    def handle(self, *args, **options):
        host = None
        if options['host']:
            host = User.objects.filter(username=options['host']).first()
            if host is None:
                raise CommandError(f'No user named "{options["host"]}".')
        else:
            host = User.objects.filter(is_staff=True).order_by('id').first()

        t = Tournament.objects.filter(slug=options['slug']).first()
        if t and not options['reset']:
            self.stdout.write(self.style.WARNING('Tournament already seeded. Use --reset to start over.'))
            return
        if t:
            t.delete()
        t = Tournament.objects.create(slug=options['slug'], name='Pickleball Mini Tournament', host=host)
        Court.objects.bulk_create([Court(tournament=t, number=n) for n in range(1, 5)])
        schedule.build(t.pk)

        if options['verbosity']:
            self.stdout.write(self.style.SUCCESS(
                f'Seeded "{t.slug}": {Team.objects.filter(tournament=t).count()} teams, '
                f'{Match.objects.filter(tournament=t).count()} matches, {t.timeline.count()} timeline events.'
            ))
