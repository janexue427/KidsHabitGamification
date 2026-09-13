import Database from 'libsql';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR lets the database file live on a mounted disk. On a host with an
// ephemeral filesystem it is scratch space for the Turso replica instead.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const localFile = path.join(dataDir, 'app.sqlite');

const syncUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Two modes, same synchronous API:
//   • no TURSO_DATABASE_URL  → a plain local SQLite file (local development)
//   • TURSO_DATABASE_URL set → an embedded replica. Reads are served from the
//     local file, writes go to Turso, and the replica is rebuilt from Turso on
//     boot — which is what makes the data outlive a host that wipes its disk.
export const isReplica = Boolean(syncUrl);
if (syncUrl && !authToken) {
  throw new Error('TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing');
}

const rawDb = isReplica
  ? new Database(localFile, { syncUrl, authToken })
  : new Database(localFile);

if (isReplica) {
  // Pull whatever the primary already has before anything reads.
  rawDb.sync();
}

rawDb.pragma('journal_mode = WAL');
rawDb.pragma('foreign_keys = ON');

// libsql attaches a _metadata field to single-row results that better-sqlite3
// never had. Handlers that pass a row straight to res.json would leak it, so
// strip it at the boundary and keep row shapes exactly as the app expects.
const db = new Proxy(rawDb, {
  get(target, prop, receiver) {
    if (prop !== 'prepare') return Reflect.get(target, prop, receiver);
    return (sql) => {
      const stmt = target.prepare(sql);
      return new Proxy(stmt, {
        get(sTarget, sProp, sReceiver) {
          if (sProp !== 'get') return Reflect.get(sTarget, sProp, sReceiver);
          return (...args) => {
            const row = sTarget.get(...args);
            if (row && typeof row === 'object') delete row._metadata;
            return row;
          };
        },
      });
    };
  },
});

rawDb.exec(`
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
  difficulty TEXT,
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

// Migrations for databases created before a column existed. Adding a column is
// the only shape of change here, so a name check is enough to stay idempotent.
function addColumn(table, column, definition) {
  const cols = rawDb.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    rawDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumn('task_completions', 'difficulty', 'TEXT');
// Google's stable subject id. Email can change on a Google account; sub cannot,
// so it is what an account is actually keyed to once linked.
addColumn('users', 'google_sub', 'TEXT');

export default db;
