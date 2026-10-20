from django.db import models
from django.utils import timezone


class Tournament(models.Model):
    """One event, run by its host. Courts, teams, matches, notices and registrations all belong to it."""

    host = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='hosted_tournaments')
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120, default='Pickleball Mini Tournament')
    date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(default='18:00')
    teams_per_bracket = models.PositiveSmallIntegerField(default=4)
    game_minutes = models.PositiveSmallIntegerField(default=20)
    format = models.CharField(max_length=80, default='Doubles (2 players per team)')
    notes = models.TextField(blank=True, default='Please be ready 10 minutes before your scheduled match.')
    registration_open = models.BooleanField(default=True)
    drawn_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return self.name


class Court(models.Model):
    """Court N hosts bracket N (A, B, C...). Each court can be at its own venue."""

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='courts')
    number = models.PositiveSmallIntegerField()
    venue_name = models.CharField(max_length=120, blank=True)
    address = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ['tournament', 'number']
        constraints = [models.UniqueConstraint(fields=['tournament', 'number'], name='unique_tournament_court')]

    def __str__(self):
        return f'Court {self.number}'


class TimelineEvent(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='timeline')
    order = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    activity = models.CharField(max_length=80)
    games = models.PositiveSmallIntegerField(null=True, blank=True)
    details = models.CharField(max_length=160, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.activity
