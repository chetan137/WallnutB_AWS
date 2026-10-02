'use strict';

const crypto  = require('crypto');
const express = require('express');
const router  = express.Router();

const config = require('../config');
const logger = require('../utils/logger');
const { query } = require('../db/pool');
const { ROLES, hashPassword, verifyPassword, toUser } = require('../db/users');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// ─── Signed session tokens (payload.signature, HMAC-SHA256) ──────────────────

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

// Loads the live user row on every request, so a deactivated / demoted /
// deleted account loses access immediately instead of when its token expires.
async function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.header('authorization') || '');
  const payload = m && verify(m[1]);
  if (!payload) return res.status(401).json({ ok: false, error: 'Please sign in again' });
  try {
    const { rows } = await query('SELECT * FROM app_users WHERE id = $1 AND active', [payload.uid]);
    if (!rows[0]) return res.status(401).json({ ok: false, error: 'Account is disabled or removed' });
    req.user = rows[0];
    next();
  } catch (err) {
    logger.error('Auth lookup failed', { error: err.message });
    res.status(500).json({ ok: false, error: 'Authentication failed' });
  }
}

function requireCeo(req, res, next) {
  if (req.user.role !== 'ceo') return res.status(403).json({ ok: false, error: 'Only the CEO can manage users' });
  next();
}

// ─── Input validation ────────────────────────────────────────────────────────

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/** Validates + normalises the editable fields. Returns { error } or { value }. */
function parseUserInput(body, { partial }) {
  const v = {};
  if (!partial || body.name !== undefined) {
    v.name = clean(body.name);
    if (!v.name) return { error: 'Name is required' };
  }
  if (!partial || body.username !== undefined) {
    v.username = clean(body.username);
    if (!/^[A-Za-z0-9._@-]{3,60}$/.test(v.username)) {
      return { error: 'Username must be 3–60 characters (letters, numbers, . _ @ -)' };
    }
  }
  if (!partial || body.password) {
    if (typeof body.password !== 'string' || body.password.length < 6) {
      return { error: 'Password must be at least 6 characters' };
    }
    v.password = body.password;
  }
  if (!partial || body.role !== undefined) {
    if (!ROLES.includes(body.role)) return { error: 'Invalid role' };
    v.role = body.role;
  }
  for (const [key, field] of [['state', 'state'], ['district', 'district'], ['salesMan', 'sales_man']]) {
    if (body[key] !== undefined) v[field] = clean(body[key]) || null;
  }
  if (body.active !== undefined) v.active = !!body.active;
  return { value: v };
}

/** The scope field a role needs, or null if the role is complete. */
function missingScope(role, u) {
  if (role === 'state_sales_head' && !u.state) return 'State is required for a State Sales Head';
  if (role === 'district_manager' && !u.district) return 'District is required for a District Manager';
  if (role === 'sales_officer' && !u.sales_man) return 'Sales person name is required for a Sales Officer';
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const username = clean(req.body.username);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const { rows } = await query('SELECT * FROM app_users WHERE LOWER(username) = LOWER($1)', [username]);
    const row = rows[0];
    // Same message for unknown user / wrong password / disabled account.
    if (!row || !row.active || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }
    res.json({ ok: true, token: sign({ uid: row.id, exp: Date.now() + TOKEN_TTL_MS }), user: toUser(row) });
  } catch (err) {
    logger.error('Login failed', { error: err.message });
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ ok: true, user: toUser(req.user) }));

router.get('/', requireAuth, requireCeo, async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM app_users ORDER BY role, name');
    res.json({ ok: true, users: rows.map(toUser) });
  } catch (err) {
    logger.error('List users failed', { error: err.message });
    res.status(500).json({ ok: false, error: 'Failed to load users' });
  }
});

router.post('/', requireAuth, requireCeo, async (req, res) => {
  const { error, value: v } = parseUserInput(req.body, { partial: false });
  if (error) return res.status(400).json({ ok: false, error });
  const scopeError = missingScope(v.role, v);
  if (scopeError) return res.status(400).json({ ok: false, error: scopeError });
  try {
    const { rows } = await query(
      `INSERT INTO app_users (name, username, password_hash, role, state, district, sales_man, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [v.name, v.username, hashPassword(v.password), v.role, v.state || null, v.district || null, v.sales_man || null, v.active !== false]
    );
    res.status(201).json({ ok: true, user: toUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Username already exists' });
    logger.error('Create user failed', { error: err.message });
    res.status(500).json({ ok: false, error: 'Failed to create user' });
  }
});

router.put('/:id', requireAuth, requireCeo, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { error, value: v } = parseUserInput(req.body, { partial: true });
  if (error) return res.status(400).json({ ok: false, error });
  try {
    const { rows: found } = await query('SELECT * FROM app_users WHERE id = $1', [id]);
    const existing = found[0];
    if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

    const next = { ...existing, ...v };
    const scopeError = missingScope(next.role, next);
    if (scopeError) return res.status(400).json({ ok: false, error: scopeError });

    const losesCeo = existing.role === 'ceo' && existing.active && (next.role !== 'ceo' || next.active === false);
    if (losesCeo) {
      if (existing.id === req.user.id) {
        return res.status(400).json({ ok: false, error: 'You cannot demote or disable your own account' });
      }
      const { rows } = await query("SELECT COUNT(*)::int AS n FROM app_users WHERE role = 'ceo' AND active AND id <> $1", [id]);
      if (rows[0].n === 0) return res.status(400).json({ ok: false, error: 'At least one active CEO account is required' });
    }

    const { rows } = await query(
      `UPDATE app_users SET name=$2, username=$3, password_hash=$4, role=$5, state=$6, district=$7,
              sales_man=$8, active=$9, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, next.name, next.username, v.password ? hashPassword(v.password) : existing.password_hash,
       next.role, next.state || null, next.district || null, next.sales_man || null, next.active]
    );
    res.json({ ok: true, user: toUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Username already exists' });
    logger.error('Update user failed', { error: err.message });
    res.status(500).json({ ok: false, error: 'Failed to update user' });
  }
});

router.delete('/:id', requireAuth, requireCeo, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rows: found } = await query('SELECT * FROM app_users WHERE id = $1', [id]);
    const target = found[0];
    if (!target) return res.status(404).json({ ok: false, error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ ok: false, error: 'You cannot delete your own account' });
    if (target.role === 'ceo' && target.active) {
      const { rows } = await query("SELECT COUNT(*)::int AS n FROM app_users WHERE role = 'ceo' AND active AND id <> $1", [id]);
      if (rows[0].n === 0) return res.status(400).json({ ok: false, error: 'At least one active CEO account is required' });
    }
    await query('DELETE FROM app_users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Delete user failed', { error: err.message });
    res.status(500).json({ ok: false, error: 'Failed to delete user' });
  }
});

module.exports = router;
