import secrets
import uuid

from django.db import models


def invite_code():
    # Unambiguous characters only (no 0/O, 1/I/L) so codes are easy to read aloud or type.
    alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(secrets.choice(alphabet) for _ in range(6))


class Entry(models.Model):
    """A team in a tournament's field: registered by its players, or added by the host (names only,
    no accounts). The draw later places it into a bracket slot (teams.Team)."""

    FORMING = 'forming'
    CONFIRMED = 'confirmed'
    WAITLIST = 'waitlist'
    WITHDRAWN = 'withdrawn'
    STATUSES = [(FORMING, 'Waiting for partner'), (CONFIRMED, 'Confirmed'), (WAITLIST, 'Waitlist'), (WITHDRAWN, 'Withdrawn')]

    tournament = models.ForeignKey('event.Tournament', on_delete=models.CASCADE, related_name='entries')
    name = models.CharField(max_length=80)
    captain = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.CASCADE, related_name='captained_entries')
    partner = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='partnered_entries')
    # Player names for host-added teams, which have no accounts.
    player1 = models.CharField(max_length=80, blank=True)
    player2 = models.CharField(max_length=80, blank=True)
    invite_code = models.CharField(max_length=8, unique=True, default=invite_code)
    status = models.CharField(max_length=10, choices=STATUSES, default=FORMING)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    checkin_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    slot = models.OneToOneField('teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='entry')

    class Meta:
        ordering = ['created_at']
        verbose_name_plural = 'entries'

    def __str__(self):
        return f'{self.name} ({self.get_status_display()})'
