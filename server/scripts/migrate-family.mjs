/**
 * Copy one family and everything attached to it from a source SQLite database
 * into a target database (a local file, or Turso when TURSO_DATABASE_URL is set).
 *
 * Primary keys and password hashes are carried across unchanged, so existing
 * logins keep working — nobody has to reset anything.
 *
 *   node scripts/migrate-family.mjs <parent-email> [--dry-run]
 *
 * Target is chosen the same way the app chooses one:
 *   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN  → Turso
 *   TARGET_FILE                            → that local file (used by tests)
 */
import Database from 'libsql';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const email = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!email) {
  console.error('usage: node scripts/migrate-family.mjs <parent-email> [--dry-run]');
  process.exit(1);
}

const sourcePath = process.env.SOURCE_FILE || path.join(__dirname, '..', 'data', 'app.sqlite');
const source = new Database(sourcePath, { readonly: true });

const syncUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const targetFile = process.env.TARGET_FILE;
let target;
let targetLabel;
if (syncUrl) {
  if (!authToken) throw new Error('TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing');
  target = new Database(path.join(__dirname, '..', 'data', 'migrate-replica.sqlite'), { syncUrl, authToken });
  target.sync();
  targetLabel = syncUrl;
} else if (targetFile) {
  target = new Database(targetFile);
  targetLabel = targetFile;
} else {
  throw new Error('set TURSO_DATABASE_URL (+ token) or TARGET_FILE to choose a target');
}

// The target may be empty. Copy the schema straight from the source so the two
// databases are structurally identical — importing the app's db.js would build
// tables in the app's own data directory, not in the target.
const ddl = source
  .prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((r) => r.sql);
target.pragma('foreign_keys = OFF'); // rows arrive parent-first, but be forgiving
for (const stmt of ddl) {
  target.exec(stmt.replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ')
                  .replace(/^CREATE INDEX /i, 'CREATE INDEX IF NOT EXISTS ')
                  .replace(/^CREATE UNIQUE INDEX /i, 'CREATE UNIQUE INDEX IF NOT EXISTS '));
}

const parent = source
  .prepare("SELECT * FROM users WHERE lower(email) = lower(?) AND role = 'parent'")
  .get(email);
if (!parent) throw new Error(`no parent account found for ${email} in ${sourcePath}`);
const familyId = parent.family_id;
const family = source.prepare('SELECT * FROM families WHERE id = ?').get(familyId);

// Ordered parent-first so foreign keys are always satisfiable on insert.
const plan = [
  ['families', 'SELECT * FROM families WHERE id = ?', [familyId]],
  ['users', 'SELECT * FROM users WHERE family_id = ?', [familyId]],
  ['tasks', 'SELECT * FROM tasks WHERE family_id = ?', [familyId]],
  ['milestones', 'SELECT * FROM milestones WHERE family_id = ?', [familyId]],
  ['rewards', 'SELECT * FROM rewards WHERE family_id = ?', [familyId]],
  ['task_assignments', 'SELECT ta.* FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id WHERE t.family_id = ?', [familyId]],
  ['task_completions', 'SELECT tc.* FROM task_completions tc JOIN tasks t ON t.id = tc.task_id WHERE t.family_id = ?', [familyId]],
  ['milestone_assignments', 'SELECT ma.* FROM milestone_assignments ma JOIN milestones m ON m.id = ma.milestone_id WHERE m.family_id = ?', [familyId]],
  ['xp_transactions', 'SELECT x.* FROM xp_transactions x JOIN users u ON u.id = x.kid_id WHERE u.family_id = ?', [familyId]],
  ['suggestions', 'SELECT * FROM suggestions WHERE family_id = ?', [familyId]],
  ['redemptions', 'SELECT r.* FROM redemptions r JOIN users u ON u.id = r.kid_id WHERE u.family_id = ?', [familyId]],
];

console.log(`source : ${sourcePath}`);
console.log(`target : ${targetLabel}`);
console.log(`family : ${family.name} (${familyId}), invite code ${family.invite_code}\n`);

let total = 0;
const work = [];
for (const [table, sql, args] of plan) {
  const rows = source.prepare(sql).all(...args);
  rows.forEach((r) => delete r._metadata);
  console.log(`  ${table.padEnd(22)} ${String(rows.length).padStart(4)} row(s)`);
  total += rows.length;
  work.push([table, rows]);
}
console.log(`\n  ${total} rows total`);

if (dryRun) {
  console.log('\n  --dry-run: nothing written');
  process.exit(0);
}

// INSERT OR IGNORE keeps a re-run from duplicating anything already copied.
target.transaction(() => {
  for (const [table, rows] of work) {
    for (const row of rows) {
      const cols = Object.keys(row);
      const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
      target.prepare(sql).run(...cols.map((c) => row[c]));
    }
  }
})();

const check = target.prepare("SELECT id, email, password_hash FROM users WHERE lower(email) = lower(?)").get(email);
console.log('\n  written.');
console.log('  parent row present in target :', Boolean(check));
console.log('  password hash identical      :', check?.password_hash === parent.password_hash);
