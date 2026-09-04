/**
 * controllers/tallyController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Express request handlers for all Tally-related endpoints.
 *
 * Data-source dispatch (config.dataSource, i.e. DATA_SOURCE env var):
 *   'db'    — read from PostgreSQL on the Antraweb VM (production). Falls
 *             back to local demo data if Postgres is unreachable.
 *   'tally' — hit TallyPrime's XML API directly (local dev only). Falls back
 *             to local demo data on any error (tallyFetchService already
 *             handles this).
 *   'local' — always serve the bundled demo dataset from data.js.
 *
 * Import endpoints (unrelated to dataSource — always write straight to Tally):
 *  POST /api/tally/import          — imports all vouchers from data.js
 *  POST /api/tally/import/:vchNo   — imports a single voucher
 *
 * Fetch endpoints (data → JSON, shaped per utils/salesAggregations.js):
 *  GET  /api/tally/sales
 *  GET  /api/tally/dealers
 *  GET  /api/tally/outstanding
 *  GET  /api/tally/inventory
 *  GET  /api/tally/data            — full salesData array, consumed by RoleContext
 *  GET  /api/tally/sync            — same as /data but bypasses the DB cache
 *  GET  /api/tally/health          — checks if Tally is reachable
 */

'use strict';

const config = require('../config');
const { importAllVouchers, importSingleVoucher } = require('../services/tallyImportService');
const tallyFetchService = require('../services/tallyFetchService');
const dbDataService = require('../services/dbDataService');
const { salesData, allDealers, allSalesOfficers, inventorySummary } = require('../data');
const { summarizeSales, summarizeDealers, summarizeOutstanding, summarizeInventory } = require('../utils/salesAggregations');
const logger = require('../utils/logger');

// ─── Data-source dispatch ─────────────────────────────────────────────────────

/**
 * Runs the fetcher for config.dataSource, always falling back to local demo
 * data so the dashboard never renders empty.
 *   dbFn    — called when DATA_SOURCE=db
 *   tallyFn — called when DATA_SOURCE=tally (already falls back to local internally)
 *   localFn — called when DATA_SOURCE=local, and as the final fallback for 'db'
 */
async function withDataSource(label, { dbFn, tallyFn, localFn }) {
  if (config.dataSource === 'db') {
    try {
      return await dbFn();
    } catch (err) {
      logger.warn(`${label}: Postgres unavailable — using local demo data.`, { reason: err.message });
      return localFn();
    }
  }
  if (config.dataSource === 'tally') {
    return tallyFn();
  }
  return localFn();
}

/**
 * Resolves the full salesData array (the payload RoleContext actually
 * consumes) per config.dataSource.
 * @param {{ bypassCache?: boolean }} opts
 */
async function fetchDashboardData({ bypassCache = false } = {}) {
  const localFallback = () => ({
    source: 'local',
    lastSync: null,
    salesData,
    allDealers,
    allSalesOfficers,
    inventorySummary,
  });

  if (config.dataSource === 'db') {
    try {
      const result = await dbDataService.fetchLiveSalesData({ bypassCache });
      if (result.salesData.length > 0) {
        logger.success(`fetchDashboardData: ${result.salesData.length} records from Postgres.`);
        return { source: 'db', lastSync: new Date().toISOString(), salesData: result.salesData };
      }
      logger.warn('fetchDashboardData: Postgres returned 0 records — using local demo data.');
    } catch (err) {
      logger.warn('fetchDashboardData: Postgres unavailable — using local demo data.', { reason: err.message });
    }
    return localFallback();
  }

  if (config.dataSource === 'tally') {
    try {
      const result = await tallyFetchService.fetchLiveSalesData();
      if (result && result.salesData && result.salesData.length > 0) {
        logger.success(`fetchDashboardData: ${result.salesData.length} live records fetched from Tally.`);
        return { ...result, source: 'tally', lastSync: new Date().toISOString() };
      }
      logger.warn('fetchDashboardData: Tally returned 0 records — using local demo data.');
    } catch (err) {
      logger.warn('fetchDashboardData: Tally unreachable — using local demo data.', { reason: err.message });
    }
    return localFallback();
  }

  return localFallback();
}

function buildDashboardResponse(liveData) {
  return {
    ok: true,
    source: liveData.source,
    lastSync: liveData.lastSync,
    data: {
      salesData:        liveData.salesData,
      allDealers:       liveData.allDealers       || allDealers,
      allSalesOfficers: liveData.allSalesOfficers || allSalesOfficers,
      inventorySummary: liveData.inventorySummary || inventorySummary,
    },
  };
}

// ─── Import Controllers ───────────────────────────────────────────────────────

/**
 * POST /api/tally/import
 * Imports ALL vouchers from data.js into Tally Prime.
 * This can take 30–120 seconds depending on record count.
 */
async function importAll(req, res) {
  try {
    logger.info('Import request received — starting full import…');
    const result = await importAllVouchers();

    const statusCode = result.failed > 0 ? 207 : 200; // 207 Multi-Status if partial failures
    return res.status(statusCode).json({
      ok: result.failed === 0,
      message: result.failed === 0
        ? `Successfully imported ${result.imported} vouchers.`
        : `Import completed with ${result.failed} failure(s).`,
      data: result,
    });
  } catch (err) {
    logger.error('importAll controller error.', { message: err.message });
    return res.status(500).json({
      ok: false,
      message: err.message,
      data: null,
    });
  }
}

/**
 * POST /api/tally/import/:vchNo
 * Re-imports a specific voucher by number.
 */
async function importOne(req, res) {
  const { vchNo } = req.params;
  try {
    const result = await importSingleVoucher(decodeURIComponent(vchNo));
    return res.json({ ok: true, data: result });
  } catch (err) {
    logger.error('importOne controller error.', { vchNo, message: err.message });
    return res.status(404).json({ ok: false, message: err.message, data: null });
  }
}

// ─── Fetch Controllers ────────────────────────────────────────────────────────

/**
 * GET /api/tally/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns sales register data aggregated for the dashboard.
 */
async function getSales(req, res) {
  try {
    const { from, to } = req.query;
    const data = await withDataSource('getSales', {
      dbFn:    () => dbDataService.fetchSales({ from, to }),
      tallyFn: () => tallyFetchService.fetchSales({ from, to }),
      localFn: () => summarizeSales(salesData, 'local'),
    });
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error('getSales controller error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * GET /api/tally/dealers
 * Returns dealer / ledger master data.
 */
async function getDealers(req, res) {
  try {
    const data = await withDataSource('getDealers', {
      dbFn:    () => dbDataService.fetchDealers(),
      tallyFn: () => tallyFetchService.fetchDealers(),
      localFn: () => summarizeDealers(salesData, 'local'),
    });
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error('getDealers controller error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * GET /api/tally/outstanding
 * Returns outstanding receivables per dealer.
 */
async function getOutstanding(req, res) {
  try {
    const data = await withDataSource('getOutstanding', {
      dbFn:    () => dbDataService.fetchOutstanding(),
      tallyFn: () => tallyFetchService.fetchOutstanding(),
      localFn: () => summarizeOutstanding(salesData, 'local'),
    });
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error('getOutstanding controller error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * GET /api/tally/inventory
 * Returns stock / inventory summary.
 */
async function getInventory(req, res) {
  try {
    const data = await withDataSource('getInventory', {
      dbFn:    () => dbDataService.fetchInventory(),
      tallyFn: () => tallyFetchService.fetchInventory(),
      localFn: () => summarizeInventory(salesData, 'local'),
    });
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error('getInventory controller error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * Payables, cash flow and financials only exist in Postgres — there's no
 * local demo or live-Tally equivalent to fall back to (data.js never
 * modeled them). Returns a clear "unavailable" response instead of a fake
 * empty dataset when dataSource isn't 'db' or Postgres can't be reached.
 */
async function dbOnly(res, label, fn) {
  if (config.dataSource !== 'db') {
    return res.status(503).json({ ok: false, message: `${label} requires DATA_SOURCE=db.`, data: null });
  }
  try {
    const data = await fn();
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error(`${label} controller error.`, { message: err.message });
    return res.status(503).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * GET /api/tally/payables
 * Vendor-wise outstanding payables + aging buckets.
 */
async function getPayables(req, res) {
  return dbOnly(res, 'getPayables', () => dbDataService.fetchPayables());
}

/**
 * GET /api/tally/cashflow
 * Receipts & Payments summary per company.
 */
async function getCashFlow(req, res) {
  return dbOnly(res, 'getCashFlow', () => dbDataService.fetchCashFlow());
}

/**
 * GET /api/tally/financials
 * P&L + Balance Sheet per company (Tally's authoritative group totals).
 */
async function getFinancials(req, res) {
  return dbOnly(res, 'getFinancials', () => dbDataService.fetchFinancials());
}

/**
 * GET /api/tally/receivables-aging
 * Customer-wise debtors aging (mirror of /payables for money owed TO us).
 */
async function getReceivablesAging(req, res) {
  return dbOnly(res, 'getReceivablesAging', () => dbDataService.fetchReceivablesAging());
}

/**
 * GET /api/tally/pareto
 * Top customers / top products by revenue with cumulative % (80/20 rule).
 */
async function getPareto(req, res) {
  return dbOnly(res, 'getPareto', () => dbDataService.fetchParetoAnalysis());
}

/**
 * GET /api/tally/abc-analysis
 * Items classified A/B/C by sales-revenue contribution.
 */
async function getAbcAnalysis(req, res) {
  return dbOnly(res, 'getAbcAnalysis', () => dbDataService.fetchAbcAnalysis());
}

/**
 * GET /api/tally/slow-moving-stock
 * Items bucketed by days since their last real inventory movement.
 */
async function getSlowMovingStock(req, res) {
  return dbOnly(res, 'getSlowMovingStock', () => dbDataService.fetchSlowMovingStock());
}

/**
 * GET /api/tally/health
 * Pings the Tally XML port and reports reachability.
 */
async function healthCheck(req, res) {
  const axios  = require('axios');

  const pingXml = `<?xml version="1.0"?><ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;

  try {
    await axios.post(config.tally.baseUrl, pingXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 5000,
    });
    return res.json({ ok: true, tally: 'connected', url: config.tally.baseUrl });
  } catch (err) {
    const isDown = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT';
    return res.status(isDown ? 503 : 500).json({
      ok: false,
      tally: isDown ? 'unreachable' : 'error',
      url: config.tally.baseUrl,
      reason: err.message,
    });
  }
}

/**
 * GET /api/tally/data
 * Returns dashboard data per config.dataSource (db → tally → local, with
 * fallback at every stage). Cached for config.cacheTtlMs when reading from
 * Postgres. Response includes `source` so the frontend can show a badge.
 */
async function getAllData(req, res) {
  try {
    const liveData = await fetchDashboardData();
    return res.json(buildDashboardResponse(liveData));
  } catch (err) {
    logger.error('getAllData error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * GET /api/tally/sync
 * Force-refresh: bypasses the Postgres cache and returns fresh data.
 * Same shape as /api/tally/data.
 */
async function syncFromTally(req, res) {
  try {
    logger.info('Manual sync requested — fetching fresh data…');
    const liveData = await fetchDashboardData({ bypassCache: true });
    return res.json(buildDashboardResponse(liveData));
  } catch (err) {
    logger.error('syncFromTally error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

module.exports = {
  importAll, importOne, getSales, getDealers, getOutstanding, getInventory,
  getPayables, getCashFlow, getFinancials,
  getReceivablesAging, getPareto, getAbcAnalysis, getSlowMovingStock,
  healthCheck, getAllData, syncFromTally,
};
