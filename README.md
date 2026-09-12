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
