/**
 * config/index.js
 * Centralised configuration loaded from environment variables.
 * All other modules import from here — never read process.env directly.
 */

'use strict';

require('dotenv').config();

const config = {
  /** Express server port */
  port: parseInt(process.env.PORT, 10) || 4000,

  /** Runtime environment */
  env: process.env.NODE_ENV || 'development',

  /** Tally Prime connection */
  tally: {
    host: process.env.TALLY_HOST || 'http://localhost',
    port: parseInt(process.env.TALLY_PORT, 10) || 9000,
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
    .map((o) => o.trim()),
};

module.exports = config;
