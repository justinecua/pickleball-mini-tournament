from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from event.models import Tournament

from .models import Match

T = '/api/t/pickleball-mini-tournament'


class TournamentFlowTests(APITestCase):
    def setUp(self):
        call_command('seed_tournament', verbosity=0)
        self.admin = User.objects.create_user('organizer', 'org@example.com', 'pass-12345', is_staff=True)
        self.client.force_authenticate(self.admin)

    def score(self, match, s1, s2, base=T):
        return self.client.patch(f'{base}/matches/{match.id}/', {'score1': s1, 'score2': s2, 'status': 'completed'})

    def play_round_robin(self):
        # Lower seed always wins 11-5, so seeds 1 and 2 advance from every bracket.
        for m in Match.objects.filter(stage=Match.ROUND_ROBIN):
            first_wins = m.team1.seed < m.team2.seed
            self.assertEqual(self.score(m, 11 if first_wins else 5, 5 if first_wins else 11).status_code, 200)

    def test_seed_matches_printed_schedule(self):
        self.assertEqual(Match.objects.count(), 32)
        self.assertEqual(Match.objects.filter(stage=Match.ROUND_ROBIN).count(), 24)
        m = Match.objects.get(code='RR-C-6')
        self.assertEqual((m.team1.code, m.team2.code, m.court, m.start_time.strftime('%H:%M')), ('C2', 'C3', 3, '19:40'))

    def test_ties_rejected(self):
        m = Match.objects.get(code='RR-A-1')
        self.assertEqual(self.score(m, 11, 11).status_code, 400)

    def test_full_tournament_advancement(self):
        self.assertIsNone(Match.objects.get(code='QF1').team1)
        self.play_round_robin()
        qf = {m.code: (m.team1.code, m.team2.code) for m in Match.objects.filter(stage=Match.QUARTERFINAL)}
        self.assertEqual(qf, {'QF1': ('A1', 'B2'), 'QF2': ('B1', 'A2'), 'QF3': ('C1', 'D2'), 'QF4': ('D1', 'C2')})

        for code in ['QF1', 'QF2', 'QF3', 'QF4']:
            self.score(Match.objects.get(code=code), 11, 7)
        for code in ['SF1', 'SF2']:
            self.score(Match.objects.get(code=code), 9, 11)
        final, third = Match.objects.get(code='F'), Match.objects.get(code='3P')
        self.assertEqual((final.team1.code, final.team2.code), ('B1', 'D1'))
        self.assertEqual((third.team1.code, third.team2.code), ('A1', 'C1'))

        self.score(final, 11, 8)
        summary = self.client.get(f'{T}/summary/').json()
        self.assertEqual(summary['placements']['champion']['code'], 'B1')
        self.assertEqual(summary['completed_matches'], 31)

        # Changing a QF result invalidates the downstream semifinal and final.
        self.score(Match.objects.get(code='QF1'), 3, 11)
        sf1 = Match.objects.get(code='SF1')
        self.assertEqual(sf1.team1.code, 'B2')
        self.assertEqual(sf1.status, Match.SCHEDULED)
        self.assertIsNone(Match.objects.get(code='F').team1)

    def play(self, tournament, base):
        for m in Match.objects.filter(tournament=tournament, stage=Match.ROUND_ROBIN):
            first_wins = m.team1.seed < m.team2.seed
            self.assertEqual(self.score(m, 11 if first_wins else 5, 5 if first_wins else 11, base).status_code, 200)

    def test_three_courts_use_best_runner_up(self):
        res = self.client.post('/api/tournaments/', {'name': 'Three Court Open', 'courts': 3}, format='json')
        self.assertEqual(res.status_code, 201)
        t = Tournament.objects.get(slug='three-court-open')
        base = f'/api/t/{t.slug}'
        self.assertEqual(Match.objects.filter(tournament=t, stage=Match.ROUND_ROBIN).count(), 18)
        sf1 = Match.objects.get(tournament=t, code='SF1')
        self.assertEqual((sf1.team1_source, sf1.team2_source), ('S1', 'S4'))

        # Bracket C's runner-up wins by the biggest margin, so it is the wildcard.
        for m in Match.objects.filter(tournament=t, stage=Match.ROUND_ROBIN):
            first_wins = m.team1.seed < m.team2.seed
            loser = 0 if m.bracket == 'C' else 5
            self.score(m, 11 if first_wins else loser, loser if first_wins else 11, base)
        standings = self.client.get(f'{base}/standings/').json()
        self.assertEqual((standings['per_bracket'], standings['wildcards']), (1, 1))
        qualified = [r['team']['code'] for b in standings['brackets'].values() for r in b['rows'] if r.get('qualified')]
        self.assertEqual(sorted(qualified), ['A1', 'B1', 'C1', 'C2'])
        sf1.refresh_from_db()
        self.assertEqual({sf1.team1.code, sf1.team2.code}, {'C1', 'C2'})

    def test_one_court_goes_straight_to_final(self):
        self.client.post('/api/tournaments/', {'name': 'Solo Court', 'courts': 1, 'teams_per_bracket': 5}, format='json')
        t = Tournament.objects.get(slug='solo-court')
        self.assertEqual(Match.objects.filter(tournament=t, stage=Match.ROUND_ROBIN).count(), 10)
        self.assertEqual(list(Match.objects.filter(tournament=t).exclude(stage=Match.ROUND_ROBIN).values_list('code', flat=True)), ['F'])
        self.play(t, f'/api/t/{t.slug}')
        final = Match.objects.get(tournament=t, code='F')
        self.assertEqual((final.team1.code, final.team2.code), ('A1', 'A2'))
