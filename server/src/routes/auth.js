import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid, customAlphabet } from 'nanoid';
import db from '../db.js';
import { signToken, requireAuth, requireRole } from '../middleware/auth.js';
import { publicUser } from '../utils/serialize.js';
import { verifyGoogleIdToken, googleEnabled } from '../utils/google.js';

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

  db.prepare('INSERT INTO families (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
    .run(familyId, familyName, code, now);
  db.prepare(`
    INSERT INTO users (id, family_id, role, name, email, password_hash, avatar, total_xp, created_at)
    VALUES (?, ?, 'parent', ?, ?, ?, '🧑', 0, ?)
  `).run(parentId, familyId, parentName, normalizedEmail, passwordHash, now);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parentId);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user), family: { id: familyId, name: familyName, inviteCode: code } });
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
  res.json({ user: publicUser(user), family: { id: family.id, name: family.name, inviteCode: family.invite_code } });
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

router.get('/kids', requireAuth, requireRole('parent'), (req, res) => {
  const kids = db.prepare("SELECT * FROM users WHERE family_id = ? AND role = 'kid' ORDER BY created_at").all(req.user.familyId);
  res.json({ kids: kids.map(publicUser) });
});

export default router;
