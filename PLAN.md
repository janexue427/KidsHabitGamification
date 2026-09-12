# Kids Habit Gamification — Project Plan

A gamified habit-tracking web app for families: kids complete recurring tasks
and milestones to earn XP, and redeem XP for real-world rewards (not video
games). Parents administer tasks, milestones, rewards, and redemption
requests, and monitor every kid's progress from a dashboard.

## 1. Goals

- Make daily/weekly chores and habits fun and rewarding for kids.
- Give kids a sense of agency: they can propose new tasks/milestones and
  choose how to spend XP they've earned.
- Give parents full administrative control and visibility without needing
  to micromanage day-to-day.
- Keep rewards centered on real-world experiences (movie night, park trip,
  extra story time, choosing dinner, etc.) rather than screen/video-game time.

## 2. User Roles

- **Parent** — creates the family, manages kids, tasks, milestones, reward
  catalog; approves/rejects kid suggestions and redemption requests; sends
  bonus XP boosts; views dashboards across all kids.
- **Kid** — logs in with a simple family code + username + PIN; sees a
  bright, playful dashboard of tasks and milestones; completes tasks to earn
  XP; suggests new tasks/milestones; redeems rewards; views XP history.

## 3. Core Features

### Kids Portal
1. **Recurring tasks with XP** — daily / weekdays / weekly / custom-day
   tasks, each worth a fixed XP amount. Completing a task for the day marks
   it done and awards XP immediately.
2. **Milestones with bonus XP** — longer-running goals (e.g. "complete 10
   tasks", "7-day streak") that pay out a lump-sum XP bonus on completion,
   layered on top of regular task XP.
3. **Kid-friendly UI** — large tap targets, bright colors, avatars/emojis,
   celebratory animations/confetti on completion, simple language, minimal
   text entry.
4. **XP history trend** — a chart of XP earned over time, switchable
   between Day / Week / Month views.
5. **Suggest a task or milestone** — a simple form to propose a new
   recurring task or milestone (with a suggested XP value); goes to the
   parent as a pending request.
6. **Reward redemption** — a catalog of non-screen rewards (movie night,
   park trip, ice cream outing, stay up 30 min late, pick dinner, game
   night with family, etc.), each with an XP cost. Kids spend XP to request
   a reward; balance is held/deducted on approval.

### Parent Portal
1. **Task & milestone management** — create/edit/archive tasks and
   milestones, set XP values, assign to one or more kids.
2. **Suggestion inbox** — review kid-submitted task/milestone suggestions;
   approve (optionally adjusting XP) or reject with a note.
3. **Reward catalog management** — create/edit/archive rewards and their
   XP cost; organize by category (outing, family time, treat, privilege).
4. **Redemption administration** — approve/reject/fulfill redemption
   requests; XP is only deducted once approved.
5. **XP boosts** — send an ad-hoc bonus XP amount to any kid with a reason
   (e.g. "great attitude today!").
6. **Family dashboard** — at-a-glance cards per kid (total XP, current
   streak, tasks completed this week) plus a combined XP trend chart
   across all kids, and a live activity feed.

## 4. Data Model (relational)

- `families(id, name, invite_code)`
- `users(id, family_id, role[parent|kid], name, email, username, password_hash, pin_hash, avatar, total_xp)`
- `tasks(id, family_id, title, description, icon, xp_value, recurrence, days_of_week, active, created_by)`
- `task_assignments(task_id, kid_id)`
- `task_completions(id, task_id, kid_id, completed_date, xp_awarded)` — one row per kid per task per day
- `milestones(id, family_id, title, description, icon, target_count, bonus_xp, active, created_by)`
- `milestone_assignments(milestone_id, kid_id, progress, completed_at)`
- `xp_transactions(id, kid_id, amount, type[task|milestone|boost|redemption], source_id, note, created_at)` — the ledger that backs the history trend and total XP
- `suggestions(id, family_id, kid_id, type[task|milestone], title, description, proposed_xp, status, parent_note)`
- `rewards(id, family_id, title, description, icon, xp_cost, category, active)`
- `redemptions(id, reward_id, kid_id, xp_cost, status[pending|approved|rejected|fulfilled], requested_at, resolved_at, parent_note)`

`xp_transactions` is the single source of truth for both a kid's running
total (`users.total_xp`) and the historical trend charts — day/week/month
views are just different groupings of this ledger.

## 5. Architecture

- **Backend**: Node.js + Express, SQLite (via `better-sqlite3`) for a
  zero-config embedded database, JWT-based auth, bcrypt for password/PIN
  hashing. REST API under `/api/*`.
- **Frontend**: React + Vite, Tailwind CSS for a playful themeable design
  system, Recharts for XP trend charts, React Router for navigation,
  role-aware routing (kid vs. parent shell).
- **Monorepo layout**: `server/` (API) and `client/` (SPA), each with its
  own `package.json`; a root `README.md` documents how to run both.

## 6. Delivery Phases

1. **Phase 1 — Foundation** (this pass): DB schema, auth (family signup,
   parent login, kid login), task/milestone CRUD + completion flow, XP
   ledger, kid & parent shells with core pages, reward catalog +
   redemption flow, suggestions flow, XP boosts, dashboards, XP trend
   charts.
2. **Phase 2 — Polish**: animations/confetti, sound effects toggle, badges
   /achievements, streak visualization, push/email notifications for
   parents (new suggestion, new redemption request) and kids (suggestion
   resolved, reward approved).
3. **Phase 3 — Multi-family & hardening**: password reset, rate limiting,
   audit log, automated tests, deployment config (Docker/hosting), avatar
   uploads, theming per family.

## 7. Non-Goals

- No video-game time, screen-time minutes, or in-app purchases as reward
  options — rewards are intentionally scoped to real-world experiences.
- No social/cross-family features in Phase 1 (leaderboards across
  families, sharing, etc.).
