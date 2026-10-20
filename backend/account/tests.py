from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from matches.models import Match


class AuthAndPermissionTests(APITestCase):
    def setUp(self):
        call_command('seed_tournament', verbosity=0)
        self.match = Match.objects.get(code='RR-A-1')
        self.t = '/api/t/pickleball-mini-tournament'

    def register(self, username='player1', email='p1@example.com'):
        return self.client.post('/api/auth/register/', {
            'username': username, 'email': email, 'password': 'Sm4sh-the-dink!', 'first_name': 'Pat',
        })

    def test_register_login_me_logout(self):
        res = self.register()
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.json()['user']['is_staff'])

        res = self.client.post('/api/auth/login/', {'username': 'p1@example.com', 'password': 'Sm4sh-the-dink!'})
        self.assertEqual(res.status_code, 200)
        token = res.json()['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        self.assertEqual(self.client.get('/api/auth/me/').json()['username'], 'player1')
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_bad_login_and_weak_password_rejected(self):
        self.assertEqual(self.client.post('/api/auth/login/', {'username': 'x', 'password': 'y'}).status_code, 400)
        res = self.client.post('/api/auth/register/', {'username': 'w', 'email': 'w@e.com', 'password': '123'})
        self.assertEqual(res.status_code, 400)

    def test_players_can_view_but_not_edit(self):
        token = self.register().json()['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        self.assertEqual(self.client.get(f'{self.t}/matches/').status_code, 200)
        patch = {'score1': 11, 'score2': 4, 'status': 'completed'}
        self.assertEqual(self.client.patch(f'{self.t}/matches/{self.match.id}/', patch).status_code, 403)
        self.assertEqual(self.client.patch(f'{self.t}/', {'name': 'Hacked'}).status_code, 403)
        self.assertEqual(self.client.get('/api/users/').status_code, 403)
        # Players cannot promote themselves through /me.
        self.client.patch('/api/auth/me/', {'is_staff': True})
        self.assertFalse(User.objects.get(username='player1').is_staff)

    def test_admin_manages_any_tournament_and_users(self):
        self.register()
        admin = User.objects.create_user('boss', 'boss@example.com', 'pass-12345', is_staff=True)
        self.client.force_authenticate(admin)

        courts = [{'venue_name': 'Riverside Courts', 'address': '1 River Rd'}] * 4
        res = self.client.patch(f'{self.t}/', {'courts': courts}, format='json')
        self.assertEqual(res.json()['courts'][0]['venue_name'], 'Riverside Courts')
        self.assertEqual(self.client.post(f'{self.t}/announcements/', {'title': 'Courts open at 5:30'}).status_code, 201)
        self.assertEqual(self.client.patch(f'/api/users/{admin.id}/', {'is_staff': False}).status_code, 400)

        summary = self.client.get(f'{self.t}/summary/').json()
        self.assertEqual(summary['info']['courts'][3]['address'], '1 River Rd')
        self.assertEqual(summary['announcements'][0]['title'], 'Courts open at 5:30')

    def test_hosts_manage_only_their_own_tournaments(self):
        host = User.objects.create_user('host', 'host@example.com', 'pass-12345')
        other = User.objects.create_user('other', 'other@example.com', 'pass-12345')
        self.assertEqual(self.client.post('/api/tournaments/', {'name': 'Nope'}).status_code, 401)

        self.client.force_authenticate(host)
        res = self.client.post('/api/tournaments/', {
            'name': 'Spring Open', 'courts': [{'venue_name': 'North Park', 'address': '9 Elm St'}, {'venue_name': 'Gym'}],
            'teams_per_bracket': 3,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        spring = '/api/t/spring-open'
        self.assertTrue(res.json()['is_host'])
        self.assertEqual(res.json()['brackets'], ['A', 'B'])
        self.assertEqual(res.json()['registration']['capacity'], 6)
        self.assertEqual(self.client.patch(f'{self.t}/', {'name': 'Mine now'}).status_code, 403)

        listed = {t['slug']: t for t in self.client.get('/api/tournaments/').json()}
        self.assertTrue(listed['spring-open']['is_host'])
        self.assertEqual(listed['spring-open']['venues'], ['Gym', 'North Park'])

        # Hosts add teams by name; growing the field rebuilds the schedule.
        for i in range(7):
            self.client.post(f'{spring}/entries/add/', {'name': f'Team {i}', 'player1': 'A', 'player2': 'B'})
        statuses = [e['status'] for e in self.client.get(f'{spring}/entries/').json()]
        self.assertEqual(statuses.count('confirmed'), 6)
        self.assertEqual(statuses.count('waitlist'), 1)
        res = self.client.patch(f'{spring}/', {'teams_per_bracket': 4}, format='json')
        self.assertEqual(res.json()['registration']['capacity'], 8)
        self.assertEqual(res.json()['registration']['confirmed'], 7)
        self.assertEqual(len(self.client.get(f'{spring}/matches/').json()), 2 * 6 + 4)

        self.client.force_authenticate(other)
        self.assertEqual(self.client.post(f'{spring}/entries/add/', {'name': 'Sneaky'}).status_code, 403)
        self.assertEqual(self.client.post(f'{spring}/host/draw/').status_code, 403)
        self.assertEqual(self.client.delete(f'{spring}/').status_code, 403)

        self.client.force_authenticate(host)
        self.assertEqual(self.client.post(f'{spring}/host/draw/').status_code, 200)
        self.assertEqual(self.client.delete(f'{spring}/').status_code, 204)
        self.assertEqual(self.client.get(f'{spring}/').status_code, 404)
