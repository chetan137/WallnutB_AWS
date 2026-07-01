/**
 * routes/tally.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All Tally-related API routes.
 * Mounted at /api/tally in server.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const {
  importAll,
  importOne,
  getSales,
  getDealers,
  getOutstanding,
  getInventory,
  healthCheck,
  getAllData,
  syncFromTally,
} = require('../controllers/tallyController');

// ── Health check ──────────────────────────────────────────────────────────────
// GET /api/tally/health
// Checks whether Tally Prime is reachable on configured port.
router.get('/health', healthCheck);

// ── Sync route (force refresh from Tally) ─────────────────────────────────────
// GET /api/tally/sync
// Fetches fresh data from Tally and returns it in salesData format.
router.get('/sync', syncFromTally);

// ── Import routes (write to Tally) ────────────────────────────────────────────
// POST /api/tally/import
// Imports ALL vouchers from data.js → Tally Prime
router.post('/import', importAll);

// POST /api/tally/import/:vchNo
// Re-imports a single voucher (URL-encode the vchNo)
router.post('/import/:vchNo', importOne);

// ── Fetch routes (read from Tally → JSON) ────────────────────────────────────
// GET /api/tally/sales?from=2025-04-01&to=2025-06-30
router.get('/sales', getSales);

// GET /api/tally/dealers
router.get('/dealers', getDealers);

// GET /api/tally/outstanding
router.get('/outstanding', getOutstanding);

// GET /api/tally/inventory
router.get('/inventory', getInventory);

// GET /api/tally/data
// Returns full salesData array — consumed by the React dashboard (RoleContext).
router.get('/data', getAllData);

module.exports = router;
