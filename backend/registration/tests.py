from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from event.models import Tournament
from matches.models import Match
from teams.models import Team

from .models import Entry

T = '/api/t/pickleball-mini-tournament'


class RegistrationTests(APITestCase):
    def setUp(self):
        call_command('seed_tournament', verbosity=0)
        self.admin = User.objects.create_user('org', 'org@example.com', 'pass-12345', is_staff=True)

    def user(self, name):
        return User.objects.create_user(name, f'{name}@example.com', 'pass-12345', first_name=name.title())

    def as_user(self, user):
        self.client.force_authenticate(user)

    def make_team(self, captain, partner, name='Dinkers'):
        self.as_user(captain)
        entry = self.client.post(f'{T}/entries/', {'name': name}).json()
        self.as_user(partner)
        return self.client.post('/api/entries/join/', {'code': entry['invite_code']}).json()

    def fill(self, count):
        return [self.make_team(self.user(f'cap{i}'), self.user(f'par{i}'), f'Team {i}') for i in range(count)]

    def test_create_then_join_confirms(self):
        cap, par = self.user('cap'), self.user('par')
        self.as_user(cap)
        res = self.client.post(f'{T}/entries/', {'name': 'Kitchen Kings'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['status'], 'forming')
        self.assertIsNone(res.json()['checkin_token'])
        code = res.json()['invite_code']
        self.assertEqual(self.client.get(f'/api/entries/invite/{code}/').json()['name'], 'Kitchen Kings')

        self.as_user(par)
        joined = self.client.post('/api/entries/join/', {'code': code.lower()}).json()
        self.assertEqual(joined['status'], 'confirmed')
        self.assertEqual(joined['position'], 1)
        self.assertTrue(joined['checkin_token'])
        self.assertEqual(self.client.get(f'{T}/entries/mine/').json()['id'], joined['id'])
        self.assertNotIn('invite_code', self.client.get(f'{T}/entries/').json()[0])

    def test_one_team_per_user_and_no_self_join(self):
        cap = self.user('cap')
        self.as_user(cap)
        code = self.client.post(f'{T}/entries/', {'name': 'A'}).json()['invite_code']
        self.assertEqual(self.client.post(f'{T}/entries/', {'name': 'B'}).status_code, 400)
        self.assertEqual(self.client.post('/api/entries/join/', {'code': code}).status_code, 400)
        self.make_team(self.user('x'), self.user('y'))
        self.as_user(self.user('z'))
        full = Entry.objects.get(name='Dinkers').invite_code
        self.assertEqual(self.client.post('/api/entries/join/', {'code': full}).status_code, 400)

    def test_waitlist_and_promotion(self):
        teams = self.fill(17)
        self.assertEqual(teams[16]['status'], 'waitlist')
        self.assertEqual(teams[16]['position'], 1)
        self.as_user(User.objects.get(username='cap3'))
        self.assertEqual(self.client.post(f"{T}/entries/{teams[3]['id']}/leave/").status_code, 200)
        self.assertEqual(Entry.objects.get(pk=teams[3]['id']).status, Entry.WITHDRAWN)
        self.assertEqual(Entry.objects.get(pk=teams[16]['id']).status, Entry.CONFIRMED)

    def test_partner_leaving_frees_the_spot(self):
        team = self.make_team(self.user('cap'), self.user('par'))
        self.as_user(User.objects.get(username='par'))
        self.client.post(f"{T}/entries/{team['id']}/leave/")
        entry = Entry.objects.get(pk=team['id'])
        self.assertEqual((entry.status, entry.partner), (Entry.FORMING, None))

    def test_closed_registration_blocks_changes(self):
        Tournament.objects.update(registration_open=False)
        self.as_user(self.user('cap'))
        self.assertEqual(self.client.post(f'{T}/entries/', {'name': 'Late'}).status_code, 400)

    def test_draw_fills_slots_and_links_players(self):
        self.fill(16)
        self.as_user(self.user('player'))
        self.assertEqual(self.client.post(f'{T}/host/draw/').status_code, 403)
        self.as_user(self.admin)
        self.assertEqual(self.client.post(f'{T}/host/draw/').status_code, 200)
        self.assertEqual(Entry.objects.filter(slot__isnull=False).count(), 16)
        self.assertFalse(Team.objects.filter(name__startswith='Team A').exists())
        cap0 = User.objects.get(username='cap0')
        entry = Entry.objects.get(captain=cap0)
        self.assertEqual(entry.slot.player1, 'Cap0')
        self.assertIsNotNone(Tournament.objects.get().drawn_at)

        # Players see their drawn slot as their team in this tournament.
        self.as_user(cap0)
        self.assertEqual(self.client.get(f'{T}/').json()['my_team']['id'], entry.slot.id)
        # After the draw players cannot join or leave on their own.
        self.assertEqual(self.client.post(f'{T}/entries/{entry.id}/leave/').status_code, 400)

        # Swapping two slots moves the entries and players.
        self.as_user(self.admin)
        a1, d4 = Team.objects.get(bracket='A', seed=1), Team.objects.get(bracket='D', seed=4)
        names = (a1.name, d4.name)
        self.client.post(f'{T}/host/swap/', {'team_a': a1.id, 'team_b': d4.id})
        a1.refresh_from_db(); d4.refresh_from_db()
        self.assertEqual((a1.name, d4.name), names[::-1])

        # Once a score exists the draw is locked.
        match = Match.objects.get(code='RR-A-1')
        self.client.patch(f'{T}/matches/{match.id}/', {'score1': 11, 'score2': 3, 'status': 'completed'})
        self.assertEqual(self.client.post(f'{T}/host/draw/').status_code, 400)

    def test_partial_draw_leaves_open_slots(self):
        self.fill(5)
        self.as_user(self.admin)
        self.client.post(f'{T}/host/draw/')
        self.assertEqual(Team.objects.filter(name='Open slot').count(), 11)

    def test_checkin(self):
        team = self.make_team(self.user('cap'), self.user('par'))
        token, code = team['checkin_token'], team['checkin_code']
        self.assertEqual(self.client.get(f'/api/checkin/{token}/').json()['valid'], True)
        self.assertEqual(self.client.post(f'/api/checkin/{token}/').status_code, 403)
        self.as_user(self.admin)
        first = self.client.post(f'/api/checkin/{code.lower()}/').json()['checked_in_at']
        again = self.client.post(f'/api/checkin/{token}/').json()['checked_in_at']
        self.assertEqual(first, again)
        self.assertEqual(self.client.get('/api/checkin/not-a-ticket/').status_code, 404)

    def test_solo_players_and_pairing(self):
        solo_a, solo_b = self.user('sa'), self.user('sb')
        for u in (solo_a, solo_b):
            self.as_user(u)
            self.client.patch('/api/auth/me/', {'looking_for_partner': True, 'partner_note': 'Intermediate'}, format='json')
        self.as_user(self.admin)
        self.assertEqual(len(self.client.get(f'{T}/host/solo/').json()), 2)
        res = self.client.post(f'{T}/host/pair/', {'user_a': solo_a.id, 'user_b': solo_b.id})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['status'], 'confirmed')
        self.assertEqual(self.client.get(f'{T}/host/solo/').json(), [])

    def test_one_team_per_tournament_not_per_site(self):
        cap, par = self.user('cap'), self.user('par')
        self.make_team(cap, par)
        self.as_user(cap)
        other = self.client.post('/api/tournaments/', {'name': 'Second Event'}, format='json').json()
        res = self.client.post(f"/api/t/{other['slug']}/entries/", {'name': 'Again'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['tournament']['slug'], 'second-event')
