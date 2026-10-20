from django.db import models


class Team(models.Model):
    """A bracket slot (A1, A2, ... one bracket per court). The draw fills it with a registered team."""

    BRACKETS = [(letter, f'Bracket {letter}') for letter in 'ABCDEFGH']

    tournament = models.ForeignKey('event.Tournament', on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=80)
    player1 = models.CharField(max_length=80, blank=True)
    player2 = models.CharField(max_length=80, blank=True)
    bracket = models.CharField(max_length=1, choices=BRACKETS)
    seed = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ['tournament', 'bracket', 'seed']
        constraints = [
            models.UniqueConstraint(fields=['tournament', 'bracket', 'seed'], name='unique_tournament_bracket_seed'),
        ]

    @property
    def code(self):
        return f'{self.bracket}{self.seed}'

    def __str__(self):
        return f'{self.code} – {self.name}'
