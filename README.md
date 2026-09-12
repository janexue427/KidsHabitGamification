# Kids Habit Gamification

A gamified habit-tracking web app for families. Kids complete recurring
tasks and milestones to earn XP and redeem it for real-world rewards
(movie night, park trip, etc. — not video games). Parents administer tasks,
milestones, the reward catalog, and redemption requests, and monitor every
kid's progress from a dashboard.

See [PLAN.md](./PLAN.md) for the full project plan and data model.

## Project layout

```
server/   Express + SQLite REST API
client/   React + Vite single-page app
```

## Running locally

### 1. Backend

```bash
cd server
npm install
npm run dev       # starts the API on http://localhost:4000
```

The SQLite database file is created automatically at `server/data/app.sqlite`
on first run — no external database needed.

### 2. Frontend

```bash
cd client
npm install
npm run dev       # starts the Vite dev server on http://localhost:5173
```

The client proxies `/api` requests to `http://localhost:4000` (see
`client/vite.config.js`).

## Getting started in the app

1. Open the client, click **Create a Family**, and sign up as a parent.
2. Note the **family invite code** shown after signup.
3. Add kid profiles from the Parent Portal (Kids page) — each kid gets a
   username + PIN.
4. Kids log in with the family invite code + their username + PIN.
5. As a parent, create some tasks, milestones, and rewards, then watch kids
   earn and redeem XP.

## Deployment

The two halves deploy separately, because GitHub Pages only serves static files
and the API needs a running process.

```
client/  →  GitHub Pages   (static SPA, published by CI)
server/  →  Render          (Express + SQLite)
```

### 1. API on Render

1. Render → **New → Blueprint** → point at this repo. It reads
   [`render.yaml`](./render.yaml) and creates the `questfam-api` service.
2. Render generates a private `JWT_SECRET` automatically. The server refuses to
   start in production without one, so don't clear it.
3. Once live, note the service URL, e.g. `https://questfam-api.onrender.com`.
4. If your Pages URL differs from the default, update `CORS_ORIGIN` on the
   service — browsers block the API call otherwise.

> **Free plan caveat:** there is no persistent disk, so `app.sqlite` is wiped on
> every deploy and on idle restarts. For data that has to survive, add a disk
> mounted at `/var/data` and set `DATA_DIR=/var/data`, or move to Postgres.
> The free instance also sleeps when idle — the first request after a nap takes
> ~30s to wake it.

### 2. Client on GitHub Pages

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables** → add
   `VITE_API_BASE_URL` set to the Render URL plus `/api`, e.g.
   `https://questfam-api.onrender.com/api`.
3. Push to the default branch, or run the **Deploy client to GitHub Pages**
   workflow manually. It builds `client/` and publishes it.

The site lands at `https://<user>.github.io/<repo>/`.

The build reads two values: `BASE_PATH` (set by CI to the repo subpath, so
assets resolve) and `VITE_API_BASE_URL` (where the SPA sends API calls).
Without the variable in step 2 the site loads but cannot log in, since it falls
back to the relative `/api` that only exists behind the local dev proxy.

Deep links work because CI copies `index.html` to `404.html` — Pages has no
rewrite rules, so it serves that shell for unknown paths and the router takes
over from there.
