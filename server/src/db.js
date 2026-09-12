import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  role TEXT NOT NULL CHECK(role IN ('parent','kid')),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  username TEXT,
  password_hash TEXT,
  pin_hash TEXT,
  avatar TEXT DEFAULT '🦁',
  total_xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '✅',
  xp_value INTEGER NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'daily',
  days_of_week TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_assignments (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  kid_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (task_id, kid_id)
);

CREATE TABLE IF NOT EXISTS task_completions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  kid_id TEXT NOT NULL REFERENCES users(id),
  completed_date TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, kid_id, completed_date)
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  target_count INTEGER NOT NULL,
  bonus_xp INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestone_assignments (
  milestone_id TEXT NOT NULL REFERENCES milestones(id),
  kid_id TEXT NOT NULL REFERENCES users(id),
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  PRIMARY KEY (milestone_id, kid_id)
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id TEXT PRIMARY KEY,
  kid_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('task','milestone','boost','redemption')),
  source_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  kid_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('task','milestone')),
  title TEXT NOT NULL,
  description TEXT,
  proposed_xp INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  parent_note TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎁',
  xp_cost INTEGER NOT NULL,
  category TEXT DEFAULT 'outing',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  reward_id TEXT NOT NULL REFERENCES rewards(id),
  kid_id TEXT NOT NULL REFERENCES users(id),
  xp_cost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','fulfilled')),
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  parent_note TEXT
);
`);

export default db;
