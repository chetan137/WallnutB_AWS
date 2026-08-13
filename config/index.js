/**
 * config/index.js
 * Centralised configuration loaded from environment variables.
 * All other modules import from here — never read process.env directly.
 */

'use strict';

const path = require('path');

// Load .env relative to the backend folder, not process.cwd(). This keeps the
// config correct no matter where the process was started from (PM2, systemd,
// `node backend/server.js` from the repo root, …).
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/** Parse a truthy env string ("true"/"1"/"yes") into a boolean. */
function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

/** Parse an int env var, falling back when unset or unparseable. */
function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  /** Express server port — 5000 on AWS (open in the Security Group) */
  port: int(process.env.PORT, 5000),

  /** Runtime environment */
  env: process.env.NODE_ENV || 'development',

  /**
   * Where dashboard data comes from:
   *   'db'    — PostgreSQL on the Antraweb VM (production)
   *   'tally' — TallyPrime XML API directly (local dev only)
   *   'local' — bundled demo dataset in data.js (offline fallback)
   */
  dataSource: (process.env.DATA_SOURCE || 'db').toLowerCase(),

  /**
   * PostgreSQL on the Antraweb VM. The VM firewall whitelists this server's
   * public IP on the DB port, so we connect straight to the VM.
   * DB_* names are still honoured for backward compatibility with the old .env.
   */
  pg: {
    host:     process.env.PG_HOST     || process.env.DB_HOST     || 'localhost',
    port:     int(process.env.PG_PORT || process.env.DB_PORT, 5432),
    database: process.env.PG_DATABASE || process.env.DB_NAME     || 'wallnut_sync',
    user:     process.env.PG_USER     || process.env.DB_USER     || 'postgres',
    password: process.env.PG_PASSWORD || process.env.DB_PASSWORD || '',

    // Managed Postgres (RDS etc.) needs SSL; a plain VM install usually doesn't.
    ssl: bool(process.env.PG_SSL) ? { rejectUnauthorized: false } : false,

    max:                     int(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: int(process.env.PG_CONNECT_TIMEOUT_MS, 10_000),

    // Kill runaway queries instead of holding a connection open forever.
    statement_timeout:                int(process.env.PG_QUERY_TIMEOUT_MS, 30_000),
    query_timeout:                    int(process.env.PG_QUERY_TIMEOUT_MS, 30_000),
    idle_in_transaction_session_timeout: 30_000,
    application_name: 'wallnut-api',
  },

  /**
   * Which Tally company to serve. Empty = auto-pick the newest non-historical
   * company from the companies table (what you want for the live FY).
   */
  defaultCompanyId: process.env.DEFAULT_COMPANY_ID
    ? int(process.env.DEFAULT_COMPANY_ID, null)
    : null,

  /**
   * In-memory cache TTL for the dashboard payload. The VM syncs every 10 min,
   * so caching for a couple of minutes is free accuracy-wise.
   */
  cacheTtlMs: int(process.env.CACHE_TTL_SECONDS, 120) * 1000,

  /** TallyPrime connection — only used when dataSource === 'tally' */
  tally: {
    host: process.env.TALLY_HOST || 'http://localhost',
    port: int(process.env.TALLY_PORT, 9000),
    companyName: process.env.TALLY_COMPANY_NAME || 'Wallnut Chemicals',
    get baseUrl() {
      return `${config.tally.host}:${config.tally.port}`;
    },
    /** HTTP request timeout for Tally API calls (ms) */
    timeout: 90_000,
  },

  /** Comma-separated list of allowed CORS origins */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  /**
   * Shared secret required on the X-API-Key header for every /api/tally/*
   * request. Empty = no check (local dev default). Set this in production
   * so the API can't be scraped by anyone who has the URL — the frontend
   * sends it via VITE_API_KEY (see frontend/src/context/RoleContext.jsx).
   */
  apiKey: process.env.API_KEY || '',
};

module.exports = config;
