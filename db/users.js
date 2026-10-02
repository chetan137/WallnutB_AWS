/**
 * db/users.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard login accounts (CEO / State Head / District Manager / Sales Officer).
 *
 * These live in our own `app_users` table and are NOT connected to Tally — the
 * CEO manages them from the User Management page. Passwords are stored as
 * scrypt hashes, never in plain text.
 */

'use strict';

const crypto = require('crypto');
const { query } = require('./pool');
const logger = require('../utils/logger');

const ROLES = ['ceo', 'state_sales_head', 'district_manager', 'sales_officer'];

// First-run accounts, only inserted when the table is empty. The CEO should
// change these passwords from the User Management page after first login.
const SEED_USERS = [
  { name: 'CEO',              username: 'ceo',          password: 'Wallnut@Ceo',   role: 'ceo' },
  { name: 'Chetan',           username: 'chetan137',    password: 'chetan.137',    role: 'ceo' },
  { name: 'Dhruv Jain',       username: 'dhruv137',     password: 'dhruv.137',     role: 'ceo' },
  { name: 'State Head',       username: 'statehead',    password: 'Wallnut@State', role: 'state_sales_head', state: 'Maharashtra' },
  { name: 'District Manager', username: 'districtmgr',  password: 'Wallnut@Dist',  role: 'district_manager', state: 'Maharashtra', district: 'Kolhapur' },
  { name: 'Sales Officer',    username: 'salesofficer', password: 'Wallnut@Sales', role: 'sales_officer',    state: 'Maharashtra', district: 'Kolhapur', salesMan: 'Mr. Vaibhav Pawar' },
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/** Row → the shape the frontend expects. Never includes the password hash. */
function toUser(row) {
  const scope =
    row.role === 'ceo' ? 'All India'
    : row.role === 'state_sales_head' ? row.state
    : row.role === 'district_manager' ? row.district
    : 'Field Territory';
  return {
    id: String(row.id),
    name: row.name,
    username: row.username,
    email: row.username,
    role: row.role,
    state: row.state || null,
    district: row.district || null,
    salesMan: row.sales_man || null,
    scope: scope || '',
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id            SERIAL PRIMARY KEY,
      name          TEXT        NOT NULL,
      username      TEXT        NOT NULL,
      password_hash TEXT        NOT NULL,
      role          TEXT        NOT NULL,
      state         TEXT,
      district      TEXT,
      sales_man     TEXT,
      active        BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_key ON app_users (LOWER(username))');

  const { rows } = await query('SELECT COUNT(*)::int AS n FROM app_users');
  if (rows[0].n === 0) {
    for (const u of SEED_USERS) {
      await query(
        `INSERT INTO app_users (name, username, password_hash, role, state, district, sales_man)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [u.name, u.username, hashPassword(u.password), u.role, u.state || null, u.district || null, u.salesMan || null]
      );
    }
    logger.info(`Seeded ${SEED_USERS.length} default dashboard users into app_users`);
  }
}

module.exports = { ROLES, hashPassword, verifyPassword, toUser, ensureSchema };
