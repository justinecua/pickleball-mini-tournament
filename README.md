# PickleXP

Web system for a 16-team (32-player) doubles pickleball tournament:
4 round-robin brackets on 4 courts, then quarterfinals, semifinals, a championship and a third-place match (32 games total).

- `backend/`: Django + Django REST Framework API (SQLite), one app per feature
- `frontend/`: React (Vite) + Tailwind CSS

## Running it locally

**Backend** (port 8000):

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python manage.py migrate
./venv/bin/python manage.py seed_tournament      # 16 teams, 32 matches, timeline
./venv/bin/python manage.py createsuperuser      # your first admin account
./venv/bin/python manage.py runserver
```

**Frontend** (port 5173), in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to Django, so no extra config is needed.
If the frontend is hosted separately, set `VITE_API_URL` (see `frontend/.env.example`) and add its origin to `CORS_ALLOWED_ORIGINS` in `backend/config/settings.py`.

## Backend structure

Same layout as goodFood: each feature is its own Django app, and every app has the same files.

```
urls.py -> views.py (APIView, thin) -> queries.py (logic + raw SQL) -> dict -> JSON
```

| App | Owns |
|-----|------|
| `account` | sign-up, login tokens, the signed-in user's profile, admin user list |
| `event` | tournament details, run of show, the overview summary, `seed_tournament` |
| `teams` | the 16 bracket slots (A1–D4) |
| `matches` | schedule, scores, standings, playoff advancement |
| `registration` | team entries, invites, waitlist, draw, check-in, partner pairing |
| `announcements` | organizer notices |

- **Logic lives in `queries.py`.** Views only choose permissions and pass `request.data` through.
- **Raw SQL** through `connections['default']` against the Django-managed tables. Models exist for migrations and the Django admin.
- **Errors are values.** A query returns `{"error": ...}` (plus optional `status` or `fields`). `core/responses.py`
  turns that into the HTTP status and error shape the frontend expects, so every URL behaves as before.
- `core/` (not an app) holds the shared SQL helpers, `respond()` and the permission classes.

## Tournament flow

1. **Registration.** An admin prints the poster QR from **Admin → Registrations**; it opens `/join`.
   A player signs up and **creates a team**, then sends the invite link, code or QR to their partner.
   The team is **confirmed** as soon as the partner joins. The first 16 complete teams get in; later ones go on a **waitlist**
   and move up automatically if a confirmed team withdraws. Solo players can tick *looking for a partner*, and an admin pairs them.
2. **Draw.** The admin closes registration and clicks **Run draw**. Confirmed teams are shuffled into slots A1–D4,
   and both players' accounts are linked to their slot. Two slots can be swapped until the first score is entered.
3. **Game day.** Each confirmed team has a **QR check-in ticket** on its *My team* page. An organizer scans it with the
   phone camera (it opens `/checkin/<token>`) and taps *Check in*, or types the 8-character code on the Registrations tab.
4. **Play.** Round robin, then quarterfinals, semifinals, final and third place, as below.

### QR codes and phones
QR codes link to `VITE_PUBLIC_URL` if set, otherwise the current site address. A `localhost` link won't open on a phone,
so for testing on your network run `npx vite --host` and create `frontend/.env` with
`VITE_PUBLIC_URL=http://<your-computer's-LAN-IP>:5173`. For the event itself, deploy the site to a public URL.

## Accounts & roles

| Role | Can do |
|------|--------|
| Visitor | View overview, schedule, standings, playoffs, teams |
| Player (registered) | Everything above, plus a My account page. Their team's matches are highlighted once an admin links them to a team |
| Admin (`is_staff`) | Admin dashboard: event info, scores, team names/players, announcements, timeline, users (link to team, grant/revoke admin, delete) |

Sign-in uses DRF token auth (`Authorization: Token <key>`). The React app keeps the token in localStorage.
Promote another user to admin from **Admin → Users**, or with Django admin at `/admin/`.

## Pages

| Page | What it does |
|------|--------------|
| Overview | Tournament info, progress, live / up-next matches, timeline, winners podium |
| Schedule | Round-robin grid (Court 1 = Bracket A … Court 4 = Bracket D), then QF, SF and finals. Click a match to enter scores |
| Standings | Per-bracket table: W/L, points for/against, +/−. Top 2 advance |
| Playoffs | Elimination bracket that fills itself in as results arrive |
| Teams | Registered teams before the draw; bracket slots after it |
| Register (`/join`, `/join/<code>`) | Poster-QR landing page: sign up, create a team, join with a code, or ask for a partner |
| My team | Status (confirmed / waitlist), partner invite QR, check-in ticket QR, your games after the draw |
| Log in / Sign up / My account | Register, sign in with username or email, edit profile, see your team's games |
| Admin | Tabs for registrations (poster QR, check-in, pairing, draw), event info, scores, teams, notices, run of show and users |

## Rules

- Standings are ranked by wins, then point difference, then points scored, then seed.
- When all 6 games in a bracket are final, its top 2 are placed into the quarterfinals:
  QF1 A1 vs B2, QF2 C1 vs D2, QF3 B1 vs A2, QF4 D1 vs C2.
- SF1 = winners of QF1 and QF2, SF2 = winners of QF3 and QF4. Final = SF winners, third place = SF losers.
- Editing an earlier result re-seeds later rounds, and clears any playoff results that no longer apply.
- Ties are rejected.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/logout/` | Accounts (returns `{token, user}`) |
| GET / PATCH | `/api/auth/me/` | Current user (name and email editable) |
| GET / PATCH | `/api/info/` | Event details (PATCH: admin) |
| CRUD | `/api/announcements/`, `/api/timeline/` | Read: everyone, write: admin |
| GET / PATCH / DELETE | `/api/users/` | Admin only |
| GET / POST | `/api/entries/` | Registered teams / create a team (logged in) |
| GET | `/api/entries/mine/`, `/api/entries/invite/<code>/` | Your team / invite preview |
| POST | `/api/entries/join/`, `/api/entries/<id>/leave/` | Join with a code / leave or withdraw |
| GET / POST | `/api/checkin/<token-or-code>/` | Ticket status / check in (admin) |
| GET / POST | `/api/admin/solo/`, `/api/admin/pair/`, `/api/admin/draw/`, `/api/admin/swap/` | Admin registration tools |
| GET | `/api/summary/` | Info, progress, live and next matches, placements |
| GET | `/api/timeline/` | Timeline events |
| GET / PATCH | `/api/teams/`, `/api/teams/{id}/` | List teams / update name and players |
| GET | `/api/matches/?stage=RR\|QF\|SF\|F\|3P` | List matches |
| PATCH | `/api/matches/{id}/` | `{score1, score2, status}` where status is `scheduled`, `live` or `completed` |
| POST | `/api/matches/{id}/reset/` | Clear one match |
| GET | `/api/standings/` | Standings for each bracket |
| POST | `/api/reset-results/` | Clear every score |

All write endpoints require an admin token. Django admin is at `/admin/` (create a user with `./venv/bin/python manage.py createsuperuser`).

## Tests

```bash
cd backend && ./venv/bin/python manage.py test tournament
```
