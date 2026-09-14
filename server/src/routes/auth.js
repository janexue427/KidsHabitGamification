import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid, customAlphabet } from 'nanoid';
import db from '../db.js';
import { signToken, requireAuth, requireRole } from '../middleware/auth.js';
import { publicUser } from '../utils/serialize.js';
import { verifyGoogleIdToken, googleEnabled } from '../utils/google.js';
import { isValidTimezone, DEFAULT_TIMEZONE, todayIn, familyTimezone } from '../utils/calendar.js';

const router = Router();
const inviteCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

// Create a new family + parent account.
router.post('/signup', (req, res) => {
  const { familyName, parentName, email, password } = req.body || {};
  if (!familyName || !parentName || !email || !password) {
    return res.status(400).json({ error: 'familyName, parentName, email, password are required' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const now = new Date().toISOString();
  const familyId = nanoid();
  const code = inviteCode();
  const parentId = nanoid();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare('INSERT INTO families (id, name, invite_code, timezone, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(familyId, familyName, code, DEFAULT_TIMEZONE, now);
  db.prepare(`
    INSERT INTO users (id, family_id, role, name, email, password_hash, avatar, total_xp, created_at)
    VALUES (?, ?, 'parent', ?, ?, ?, '🧑', 0, ?)
  `).run(parentId, familyId, parentName, normalizedEmail, passwordHash, now);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parentId);
  const token = signToken(user);
  res.status(201).json({
    token,
    user: publicUser(user),
    family: { id: familyId, name: familyName, inviteCode: code, timezone: DEFAULT_TIMEZONE },
  });
});

// Parent login with email + password.
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db
    .prepare("SELECT * FROM users WHERE lower(email) = ? AND role = 'parent'")
    .get(String(email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Kid login with family invite code + username + PIN.
router.post('/kid-login', (req, res) => {
  const { inviteCode: code, username, pin } = req.body || {};
  if (!code || !username || !pin) {
    return res.status(400).json({ error: 'inviteCode, username, pin are required' });
  }
  const family = db.prepare('SELECT * FROM families WHERE invite_code = ?').get(code.toUpperCase());
  if (!family) return res.status(401).json({ error: 'Invalid family invite code' });

  const user = db.prepare(`
    SELECT * FROM users WHERE family_id = ? AND role = 'kid' AND lower(username) = lower(?)
  `).get(family.id, username);
  if (!user || !bcrypt.compareSync(pin, user.pin_hash)) {
    return res.status(401).json({ error: 'Invalid username or PIN' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Tells the client whether to offer the Google button at all, so a server
// without a client id degrades to password sign-in instead of a dead button.
router.get('/config', (req, res) => {
  res.json({ googleEnabled });
});

/**
 * Sign in with a Google ID token.
 *
 * Resolution order matters: match on Google's subject id first, then fall back
 * to a verified email so an existing password account is adopted rather than
 * duplicated. A brand-new user has no family yet, so the first call reports
 * what it needs and the client sends a family name on the second.
 */
router.post('/google', async (req, res, next) => {
  try {
    const { credential, familyName } = req.body || {};
    let identity;
    try {
      identity = await verifyGoogleIdToken(credential);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    const bySub = db.prepare("SELECT * FROM users WHERE google_sub = ? AND role = 'parent'").get(identity.sub);
    if (bySub) {
      return res.json({ token: signToken(bySub), user: publicUser(bySub) });
    }

    const byEmail = db
      .prepare("SELECT * FROM users WHERE lower(email) = ? AND role = 'parent'")
      .get(identity.email);
    if (byEmail) {
      // Existing account, same verified address: link it and let them straight in.
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(identity.sub, byEmail.id);
      const linked = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
      return res.json({ token: signToken(linked), user: publicUser(linked), linked: true });
    }

    if (!familyName) {
      return res.json({ needsFamily: true, email: identity.email, name: identity.name });
    }

    const now = new Date().toISOString();
    const familyId = nanoid();
    const code = inviteCode();
    const parentId = nanoid();
    db.transaction(() => {
      db.prepare('INSERT INTO families (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
        .run(familyId, String(familyName).trim(), code, now);
      db.prepare(`
        INSERT INTO users (id, family_id, role, name, email, google_sub, avatar, total_xp, created_at)
        VALUES (?, ?, 'parent', ?, ?, ?, '🧑', 0, ?)
      `).run(parentId, familyId, identity.name, identity.email, identity.sub, now);
    })();

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(parentId);
    res.status(201).json({
      token: signToken(created),
      user: publicUser(created),
      family: { id: familyId, name: String(familyName).trim(), inviteCode: code },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(user.family_id);
  res.json({
    user: publicUser(user),
    family: {
      id: family.id,
      name: family.name,
      inviteCode: family.invite_code,
      timezone: familyTimezone(db, family.id),
      today: todayIn(familyTimezone(db, family.id)),
    },
  });
});

// Parent adds a kid profile to the family.
router.post('/kids', requireAuth, requireRole('parent'), (req, res) => {
  const { name, username, pin, avatar } = req.body || {};
  if (!name || !username || !pin) {
    return res.status(400).json({ error: 'name, username, pin are required' });
  }
  const clash = db.prepare(`
    SELECT id FROM users WHERE family_id = ? AND role = 'kid' AND lower(username) = lower(?)
  `).get(req.user.familyId, username);
  if (clash) return res.status(409).json({ error: 'That kid username is already taken in this family' });

  const now = new Date().toISOString();
  const id = nanoid();
  const pinHash = bcrypt.hashSync(String(pin), 10);
  db.prepare(`
    INSERT INTO users (id, family_id, role, name, username, pin_hash, avatar, total_xp, created_at)
    VALUES (?, ?, 'kid', ?, ?, ?, ?, 0, ?)
  `).run(id, req.user.familyId, name, username, pinHash, avatar || '🦁', now);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ kid: publicUser(user) });
});

/**
 * Parent edits a kid in their own family: name, username, avatar, and PIN.
 *
 * The PIN is write-only — it is stored as a bcrypt hash and cannot be read
 * back, so a forgotten one is reset here rather than recovered.
 */
router.put('/kids/:id', requireAuth, requireRole('parent'), (req, res) => {
  const kid = db.prepare(`
    SELECT * FROM users WHERE id = ? AND family_id = ? AND role = 'kid'
  `).get(req.params.id, req.user.familyId);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });

  const { name, username, avatar, pin } = req.body || {};

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }
  if (username !== undefined) {
    if (!String(username).trim()) return res.status(400).json({ error: 'Username cannot be empty' });
    // Unique within the family, ignoring this kid's own current name.
    const clash = db.prepare(`
      SELECT id FROM users
      WHERE family_id = ? AND role = 'kid' AND lower(username) = lower(?) AND id != ?
    `).get(req.user.familyId, String(username).trim(), kid.id);
    if (clash) return res.status(409).json({ error: 'That kid username is already taken in this family' });
  }
  if (pin !== undefined && pin !== null && pin !== '') {
    if (!/^\d{4,8}$/.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be 4 to 8 digits' });
    }
  }

  db.prepare(`
    UPDATE users SET name = ?, username = ?, avatar = ?, pin_hash = ? WHERE id = ?
  `).run(
    name !== undefined ? String(name).trim() : kid.name,
    username !== undefined ? String(username).trim() : kid.username,
    avatar !== undefined ? avatar : kid.avatar,
    pin ? bcrypt.hashSync(String(pin), 10) : kid.pin_hash,
    kid.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(kid.id);
  res.json({ kid: publicUser(updated), pinChanged: Boolean(pin) });
});

/**
 * Parent: family settings. Only the timezone for now, but it is the setting
 * that decides when everyone's day starts and ends, so it earns its own place.
 */
router.put('/family', requireAuth, requireRole('parent'), (req, res) => {
  const { name, timezone } = req.body || {};
  if (timezone !== undefined && !isValidTimezone(timezone)) {
    return res.status(400).json({ error: 'Unknown timezone' });
  }
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Family name cannot be empty' });
  }
  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.user.familyId);
  db.prepare('UPDATE families SET name = ?, timezone = ? WHERE id = ?').run(
    name !== undefined ? String(name).trim() : family.name,
    timezone !== undefined ? timezone : family.timezone || DEFAULT_TIMEZONE,
    family.id
  );
  const updated = db.prepare('SELECT * FROM families WHERE id = ?').get(family.id);
  res.json({
    family: {
      id: updated.id,
      name: updated.name,
      inviteCode: updated.invite_code,
      timezone: updated.timezone,
      today: todayIn(updated.timezone),
    },
  });
});

/**
 * Parent: add another grown-up to the family — a second parent, a grandparent.
 * They get the same powers, because a co-parent who cannot approve a redemption
 * is not much use.
 */
router.post('/parents', requireAuth, requireRole('parent'), (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const normalized = String(email).trim().toLowerCase();
  if (!password && !googleEnabled) {
    return res.status(400).json({ error: 'A password is required unless Google sign-in is set up' });
  }
  if (password && String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const clash = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(normalized);
  if (clash) return res.status(409).json({ error: 'Someone is already signed up with that email' });

  const id = nanoid();
  db.prepare(`
    INSERT INTO users (id, family_id, role, name, email, password_hash, avatar, total_xp, created_at)
    VALUES (?, ?, 'parent', ?, ?, ?, '🧑', 0, ?)
  `).run(id, req.user.familyId, String(name).trim(), normalized,
    password ? bcrypt.hashSync(String(password), 10) : null, new Date().toISOString());

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ parent: publicUser(created), canUseGoogle: googleEnabled });
});

router.get('/parents', requireAuth, requireRole('parent'), (req, res) => {
  const parents = db
    .prepare("SELECT * FROM users WHERE family_id = ? AND role = 'parent' ORDER BY created_at")
    .all(req.user.familyId);
  res.json({
    parents: parents.map((p) => ({ ...publicUser(p), isYou: p.id === req.user.id })),
  });
});

/** Parent: remove another grown-up. Nobody may remove themselves. */
router.delete('/parents/:id', requireAuth, requireRole('parent'), (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove yourself from the family' });
  }
  const target = db
    .prepare("SELECT * FROM users WHERE id = ? AND family_id = ? AND role = 'parent'")
    .get(req.params.id, req.user.familyId);
  if (!target) return res.status(404).json({ error: 'Parent not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  res.json({ ok: true });
});

router.get('/kids', requireAuth, requireRole('parent'), (req, res) => {
  const kids = db.prepare("SELECT * FROM users WHERE family_id = ? AND role = 'kid' ORDER BY created_at").all(req.user.familyId);
  res.json({ kids: kids.map(publicUser) });
});

export default router;
