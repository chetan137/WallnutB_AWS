/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wallnut — Express API server
 *
 * Responsibilities:
 *  • Configure Express with CORS, JSON, and request logging middleware
 *  • Mount all route modules
 *  • Provide a global error handler
 *  • Start the HTTP server
 *
 * Environment variables (see .env):
 *  PORT             — server port (default 4000)
 *  TALLY_HOST       — Tally hostname (default http://localhost)
 *  TALLY_PORT       — Tally XML port (default 9000)
 *  TALLY_COMPANY    — Tally company name
 *  ALLOWED_ORIGINS  — comma-separated CORS origins
 */

'use strict';

const express = require('express');
const cors    = require('cors');

const config      = require('./config');
const logger      = require('./utils/logger');
const tallyRoutes = require('./routes/tally');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS — allow configured origins (React dev server, etc.)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) in development
    if (!origin || config.env === 'development') return callback(null, true);
    if (config.allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (development only)
if (config.env === 'development') {
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Root health check
app.get('/', (_req, res) => {
  res.json({
    service: 'Wallnut Tally API',
    version: '1.0.0',
    environment: config.env,
    tally: config.tally.baseUrl,
    endpoints: [
      'GET  /api/tally/health',
      'GET  /api/tally/sync',
      'GET  /api/tally/data',
      'POST /api/tally/import',
      'POST /api/tally/import/:vchNo',
      'GET  /api/tally/sales',
      'GET  /api/tally/dealers',
      'GET  /api/tally/outstanding',
      'GET  /api/tally/inventory',
    ],
  });
});

// Tally API routes
app.use('/api/tally', tallyRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error.', { message: err.message, stack: err.stack });
  res.status(500).json({
    ok: false,
    message: config.env === 'production' ? 'Internal server error' : err.message,
    data: null,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  logger.success(`🟢 Wallnut API running on http://localhost:${config.port}`);
  logger.info(`   Tally target: ${config.tally.baseUrl} (company: "${config.tally.companyName}")`);
  logger.info(`   Environment : ${config.env}`);
  logger.info(`   Endpoints   :`);
  logger.info(`     GET  http://localhost:${config.port}/api/tally/health`);
  logger.info(`     POST http://localhost:${config.port}/api/tally/import`);
  logger.info(`     GET  http://localhost:${config.port}/api/tally/sales`);
  logger.info(`     GET  http://localhost:${config.port}/api/tally/dealers`);
  logger.info(`     GET  http://localhost:${config.port}/api/tally/outstanding`);
  logger.info(`     GET  http://localhost:${config.port}/api/tally/inventory`);
});

module.exports = app; // exported for testing
