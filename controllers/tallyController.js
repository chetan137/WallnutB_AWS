/**
 * controllers/tallyController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Express request handlers for all Tally-related endpoints.
 *
 * Import endpoints:
 *  POST /api/tally/import          — imports all vouchers from data.js
 *  POST /api/tally/import/:vchNo   — imports a single voucher
 *
 * Fetch endpoints (data from Tally → JSON):
 *  GET  /api/tally/sales
 *  GET  /api/tally/dealers
 *  GET  /api/tally/outstanding
 *  GET  /api/tally/inventory
 *  GET  /api/tally/health          — checks if Tally is reachable
 */

'use strict';

const { importAllVouchers, importSingleVoucher } = require('../services/tallyImportService');
const { fetchSales, fetchDealers, fetchOutstanding, fetchInventory, fetchLiveSalesData } = require('../services/tallyFetchService');
const { salesData, allDealers, allSalesOfficers, inventorySummary } = require('../data');
const logger = require('../utils/logger');

// ─── Live Tally Data Fetcher ──────────────────────────────────────────────────

/**
 * Tries to pull live vouchers from Tally's Day Book.
 * Returns salesData-format records with source='tally'.
 * Falls back to local data.js with source='local' on any error.
 */
async function fetchLiveTallyData() {
  try {
    const result = await fetchLiveSalesData();
    if (result && result.salesData && result.salesData.length > 0) {
      logger.success(`getAllData: ${result.salesData.length} live records fetched from Tally.`);
      return { ...result, source: 'tally', lastSync: new Date().toISOString() };
    }
    // Tally responded but returned zero records — fall through to local
    logger.warn('getAllData: Tally returned 0 records — using local demo data.');
  } catch (err) {
    logger.warn('getAllData: Tally unreachable — using local demo data.', { reason: err.message });
  }

  return {
    source: 'local',
    lastSync: null,
    salesData,
    allDealers,
    allSalesOfficers,
    inventorySummary,
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
    const data = await fetchSales({ from, to });
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
    const data = await fetchDealers();
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
    const data = await fetchOutstanding();
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
    const data = await fetchInventory();
    return res.json({ ok: true, data });
  } catch (err) {
    logger.error('getInventory controller error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * GET /api/tally/health
 * Pings the Tally XML port and reports reachability.
 */
async function healthCheck(req, res) {
  const axios  = require('axios');
  const config = require('../config');

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
 * Returns dashboard data. Tries to fetch live vouchers from Tally's Day Book first.
 * Falls back to local data.js (demo) if Tally is unreachable.
 * Response includes `source`: 'tally' | 'local' so the frontend can show a badge.
 */
async function getAllData(req, res) {
  try {
    const liveData = await fetchLiveTallyData();
    return res.json({
      ok: true,
      source: liveData.source,
      lastSync: liveData.lastSync,
      data: {
        salesData:        liveData.salesData,
        allDealers:       liveData.allDealers       || allDealers,
        allSalesOfficers: liveData.allSalesOfficers || allSalesOfficers,
        inventorySummary: liveData.inventorySummary || inventorySummary,
      },
    });
  } catch (err) {
    logger.error('getAllData error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

/**
 * GET /api/tally/sync
 * Force-refresh: fetches fresh data from Tally and returns it.
 * Same shape as /api/tally/data.
 */
async function syncFromTally(req, res) {
  try {
    logger.info('Manual sync requested — fetching from Tally…');
    const liveData = await fetchLiveTallyData();
    return res.json({
      ok: true,
      source: liveData.source,
      lastSync: liveData.lastSync,
      data: {
        salesData:        liveData.salesData,
        allDealers:       liveData.allDealers       || allDealers,
        allSalesOfficers: liveData.allSalesOfficers || allSalesOfficers,
        inventorySummary: liveData.inventorySummary || inventorySummary,
      },
    });
  } catch (err) {
    logger.error('syncFromTally error.', { message: err.message });
    return res.status(500).json({ ok: false, message: err.message, data: null });
  }
}

module.exports = { importAll, importOne, getSales, getDealers, getOutstanding, getInventory, healthCheck, getAllData, syncFromTally };
