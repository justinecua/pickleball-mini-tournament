from django.db import models


class Match(models.Model):
    ROUND_ROBIN = 'RR'
    ROUND_OF_16 = 'R16'
    QUARTERFINAL = 'QF'
    SEMIFINAL = 'SF'
    THIRD_PLACE = '3P'
    FINAL = 'F'
    STAGES = [
        (ROUND_ROBIN, 'Round Robin'),
        (ROUND_OF_16, 'Round of 16'),
        (QUARTERFINAL, 'Quarterfinal'),
        (SEMIFINAL, 'Semifinal'),
        (THIRD_PLACE, 'Third Place'),
        (FINAL, 'Championship'),
    ]

    SCHEDULED = 'scheduled'
    LIVE = 'live'
    COMPLETED = 'completed'
    STATUSES = [(SCHEDULED, 'Scheduled'), (LIVE, 'Live'), (COMPLETED, 'Completed')]

    tournament = models.ForeignKey('event.Tournament', on_delete=models.CASCADE, related_name='matches')
    # Identifier within the tournament, e.g. "RR-A-1", "R16-3", "QF1", "SF2", "F", "3P"
    code = models.CharField(max_length=10)
    stage = models.CharField(max_length=3, choices=STAGES)
    label = models.CharField(max_length=40)
    bracket = models.CharField(max_length=1, blank=True)
    match_no = models.PositiveSmallIntegerField(default=1)
    court = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    # Where each slot's team comes from in the knockout stage:
    # "A1" = 1st place in bracket A, "S3" = 3rd seed overall (bracket winners, then best runners-up),
    # "W:QF1" = winner of QF1, "L:SF1" = loser of SF1.
    team1_source = models.CharField(max_length=10, blank=True)
    team2_source = models.CharField(max_length=10, blank=True)
    team1 = models.ForeignKey('teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    team2 = models.ForeignKey('teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    score1 = models.PositiveSmallIntegerField(null=True, blank=True)
    score2 = models.PositiveSmallIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default=SCHEDULED)

    class Meta:
        ordering = ['tournament', 'start_time', 'court']
        verbose_name_plural = 'matches'
        constraints = [models.UniqueConstraint(fields=['tournament', 'code'], name='unique_tournament_match_code')]

    def __str__(self):
        return f'{self.code} ({self.start_time:%H:%M}, court {self.court})'
