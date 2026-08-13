/**
 * db/pool.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single shared pg connection pool for the whole process.
 *
 * The database lives on the Antraweb VM (TallyPrime + PostgreSQL + the
 * tallybackend sync service). This API only ever READS from it — all writes
 * are done by the sync service on the VM.
 */

'use strict';

const { Pool, types } = require('pg');

const config = require('../config');
const logger = require('../utils/logger');

// ─── NUMERIC → JS number ──────────────────────────────────────────────────────
// node-postgres returns NUMERIC/DECIMAL as *strings* to avoid float precision
// loss. The dashboard does `sum + row.amount`, so a string would silently
// produce "0123.45" style concatenation. Money values here are well within
// float64's exact-integer range (< 2^53 paise), so parsing is safe.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));  // numeric
types.setTypeParser(20,   (v) => (v === null ? null : parseInt(v, 10))); // int8/bigint

// DATE (1082) → keep as a plain 'YYYY-MM-DD' string. The frontend compares
// dates lexicographically (`r.date >= filters.fromDate`), and a JS Date would
// shift the day across timezones.
types.setTypeParser(1082, (v) => v);

const pool = new Pool(config.pg);

// Log unexpected idle-client errors but never crash the API process.
pool.on('error', (err) => {
  logger.error('[pg-pool] Unexpected idle client error.', { message: err.message });
});

/**
 * Run a query with timing + error logging.
 * @param {string} text  SQL with $1, $2 … placeholders
 * @param {Array}  params
 */
async function query(text, params = []) {
  const startedAt = Date.now();
  try {
    const result = await pool.query(text, params);
    logger.debug(`[pg] ${result.rowCount} rows in ${Date.now() - startedAt}ms`);
    return result;
  } catch (err) {
    logger.error('[pg] Query failed.', {
      message: err.message,
      code: err.code,
      sql: text.replace(/\s+/g, ' ').slice(0, 160),
    });
    throw err;
  }
}

/**
 * Cheap liveness probe used by GET /api/health.
 * Returns { ok, latencyMs, serverTime } or { ok: false, error }.
 */
async function healthCheck() {
  const startedAt = Date.now();
  try {
    const { rows } = await pool.query('SELECT NOW() AS server_time');
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      serverTime: rows[0].server_time,
      host: `${config.pg.host}:${config.pg.port}`,
      database: config.pg.database,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      host: `${config.pg.host}:${config.pg.port}`,
      database: config.pg.database,
      error: err.message,
      // ENOTFOUND/ETIMEDOUT here almost always means the VM firewall has not
      // whitelisted this server's public IP on the Postgres port.
      code: err.code || null,
    };
  }
}

module.exports = { pool, query, healthCheck };
