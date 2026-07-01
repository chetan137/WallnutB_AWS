/**
 * services/tallyFetchService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches data FROM Tally Prime via its XML export API,
 * then converts the raw XML to clean JSON for the React dashboard.
 *
 * When Tally is unavailable (ECONNREFUSED / timeout), all fetch functions
 * gracefully fall back to the local data.js snapshot so the dashboard
 * always has data to display.
 *
 * Fallback strategy:
 *  • Try Tally → if error → use data.js → annotate response with
 *    { source: 'local' } so the frontend can show a badge.
 */

'use strict';

const axios  = require('axios');
const xml2js = require('xml2js');

const config                   = require('../config');
const logger                   = require('../utils/logger');
const { salesData, allDealers, inventorySummary } = require('../data');
const {
  buildSalesRegisterRequest,
  buildOutstandingRequest,
  buildLedgerMasterRequest,
  buildInventoryRequest,
  escapeXml,
} = require('../utils/xmlGenerator');

// ─── Low-level Tally HTTP helper ──────────────────────────────────────────────

/**
 * POSTs an XML request to Tally and returns raw string response.
 * @param {string} xml
 * @returns {Promise<string>}
 */
async function tallyRequest(xml) {
  const url = config.tally.baseUrl;
  const response = await axios.post(url, xml, {
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: config.tally.timeout,
  });
  return response.data;
}

/**
 * Parses Tally XML response into a JS object.
 * @param {string} xml
 * @returns {Promise<Object>}
 */
async function parseXml(xml) {
  return xml2js.parseStringPromise(xml, {
    explicitArray: true,   // keep arrays for collection nodes
    ignoreAttrs: false,    // preserve attributes (NAME, etc.)
    trim: true,
    normalize: true,
  });
}

// ─── Data-shaping helpers ─────────────────────────────────────────────────────

function safeGet(obj, ...keys) {
  return keys.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), obj);
}

function ensureArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function num(val) {
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// ─── Local-data fallbacks (always work, no Tally needed) ─────────────────────

function localSalesSummary() {
  // Monthly sales aggregation
  const monthly = {};
  const byState = {};
  const byOfficer = {};
  const byProduct = {};

  salesData.forEach((r) => {
    const ym = r.date.slice(0, 7); // "YYYY-MM"

    // Monthly
    if (!monthly[ym]) monthly[ym] = { month: ym, revenue: 0, txnCount: 0, qty: 0 };
    monthly[ym].revenue   += r.amount;
    monthly[ym].txnCount  += 1;
    monthly[ym].qty       += r.quantity;

    // By state
    if (!byState[r.state]) byState[r.state] = { state: r.state, revenue: 0, txnCount: 0 };
    byState[r.state].revenue  += r.amount;
    byState[r.state].txnCount += 1;

    // By officer
    if (!byOfficer[r.salesMan]) byOfficer[r.salesMan] = { name: r.salesMan, district: r.areaCity, state: r.state, revenue: 0, txnCount: 0 };
    byOfficer[r.salesMan].revenue  += r.amount;
    byOfficer[r.salesMan].txnCount += 1;

    // By product
    if (!byProduct[r.itemName]) byProduct[r.itemName] = { name: r.itemName, category: r.stockCategory, revenue: 0, qty: 0 };
    byProduct[r.itemName].revenue += r.amount;
    byProduct[r.itemName].qty     += r.quantity;
  });

  const totalRevenue = salesData.reduce((s, r) => s + r.amount, 0);

  return {
    source: 'local',
    totalRevenue,
    totalTransactions: salesData.length,
    monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
    byState: Object.values(byState).sort((a, b) => b.revenue - a.revenue),
    byOfficer: Object.values(byOfficer).sort((a, b) => b.revenue - a.revenue),
    byProduct: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue),
    recentVouchers: salesData.slice(0, 20).map((r) => ({
      vchNo: r.vchNo,
      date: r.date,
      partyName: r.partyName,
      amount: r.amount,
      vchType: r.vchType,
      state: r.state,
      salesMan: r.salesMan,
    })),
  };
}

function localDealerData() {
  const dealerStats = {};

  salesData.forEach((r) => {
    if (!dealerStats[r.partyName]) {
      dealerStats[r.partyName] = {
        name: r.partyName,
        salesOfficer: r.salesMan,
        district: r.areaCity,
        state: r.state,
        totalRevenue: 0,
        totalOutstanding: 0,
        txnCount: 0,
        lastTransactionDate: r.date,
      };
    }
    const d = dealerStats[r.partyName];
    d.totalRevenue      += r.amount;
    d.totalOutstanding  += r.finalOutstanding;
    d.txnCount          += 1;
    if (r.date > d.lastTransactionDate) d.lastTransactionDate = r.date;
  });

  return {
    source: 'local',
    totalDealers: Object.keys(dealerStats).length,
    dealers: Object.values(dealerStats).sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
}

function localOutstandingData() {
  const partyOutstanding = {};

  salesData.forEach((r) => {
    if (r.finalOutstanding <= 0) return;
    if (!partyOutstanding[r.partyName]) {
      partyOutstanding[r.partyName] = {
        partyName: r.partyName,
        salesOfficer: r.salesMan,
        district: r.areaCity,
        state: r.state,
        totalOutstanding: 0,
        totalBilled: 0,
        invoiceCount: 0,
        oldestDueDate: r.date,
      };
    }
    const p = partyOutstanding[r.partyName];
    p.totalOutstanding += r.finalOutstanding;
    p.totalBilled      += r.amount;
    p.invoiceCount     += 1;
    if (r.date < p.oldestDueDate) p.oldestDueDate = r.date;
  });

  const list = Object.values(partyOutstanding)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  return {
    source: 'local',
    totalOutstanding: list.reduce((s, p) => s + p.totalOutstanding, 0),
    totalParties: list.length,
    outstanding: list,
  };
}

function localInventoryData() {
  return {
    source: 'local',
    totalProducts: inventorySummary.length,
    inventory: inventorySummary.sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
}

// ─── Tally XML → JSON parsers ─────────────────────────────────────────────────

/**
 * Parses Tally's Day Book XML response into a clean sales JSON.
 * Tally's XML structure can be complex and vary by version;
 * this is resilient to missing nodes.
 * @param {Object} parsed
 * @returns {Object}
 */
function parseSalesFromTally(parsed) {
  const vouchers = [];
  try {
    const collection = safeGet(parsed, 'ENVELOPE', 'BODY', 0, 'DATA', 0, 'COLLECTION', 0, 'VOUCHER');
    ensureArray(collection).forEach((v) => {
      const entry = {
        vchNo:     safeGet(v, 'VOUCHERNUMBER', 0) || '',
        date:      safeGet(v, 'DATE', 0) || '',
        partyName: safeGet(v, 'PARTYLEDGERNAME', 0) || '',
        vchType:   safeGet(v, 'VOUCHERTYPENAME', 0) || '',
        amount:    num(safeGet(v, 'AMOUNT', 0)),
        narration: safeGet(v, 'NARRATION', 0) || '',
      };
      vouchers.push(entry);
    });
  } catch (e) {
    logger.warn('parseSalesFromTally: parsing error — returning empty.', { error: e.message });
  }

  const totalRevenue = vouchers.reduce((s, v) => s + Math.abs(v.amount), 0);

  return {
    source: 'tally',
    totalRevenue,
    totalTransactions: vouchers.length,
    recentVouchers: vouchers.slice(0, 20),
  };
}

/**
 * Parses Tally's Outstanding Receivables XML.
 * @param {Object} parsed
 * @returns {Object}
 */
function parseOutstandingFromTally(parsed) {
  const list = [];
  try {
    const collection = safeGet(parsed, 'ENVELOPE', 'BODY', 0, 'DATA', 0, 'COLLECTION', 0, 'LEDGER');
    ensureArray(collection).forEach((l) => {
      const name    = (safeGet(l, '$', 'NAME') || safeGet(l, 'NAME', 0) || '').toString();
      const balance = num(safeGet(l, 'CLOSINGBALANCE', 0));
      if (name && balance > 0) {
        list.push({ partyName: name, totalOutstanding: balance });
      }
    });
  } catch (e) {
    logger.warn('parseOutstandingFromTally: parsing error.', { error: e.message });
  }

  return {
    source: 'tally',
    totalOutstanding: list.reduce((s, p) => s + p.totalOutstanding, 0),
    totalParties: list.length,
    outstanding: list.sort((a, b) => b.totalOutstanding - a.totalOutstanding),
  };
}

/**
 * Parses Tally's List of Accounts (Ledgers) XML.
 * @param {Object} parsed
 * @returns {Object}
 */
function parseLedgersFromTally(parsed) {
  const dealers = [];
  try {
    const collection = safeGet(parsed, 'ENVELOPE', 'BODY', 0, 'DATA', 0, 'COLLECTION', 0, 'LEDGER');
    ensureArray(collection).forEach((l) => {
      const name  = (safeGet(l, '$', 'NAME') || '').toString();
      const group = safeGet(l, 'PARENT', 0) || '';
      if (name) dealers.push({ name, group });
    });
  } catch (e) {
    logger.warn('parseLedgersFromTally: parsing error.', { error: e.message });
  }

  return {
    source: 'tally',
    totalDealers: dealers.length,
    dealers,
  };
}

/**
 * Parses Tally's Stock Summary XML.
 * @param {Object} parsed
 * @returns {Object}
 */
function parseInventoryFromTally(parsed) {
  const inventory = [];
  try {
    const collection = safeGet(parsed, 'ENVELOPE', 'BODY', 0, 'DATA', 0, 'COLLECTION', 0, 'STOCKITEM');
    ensureArray(collection).forEach((item) => {
      const name  = (safeGet(item, '$', 'NAME') || safeGet(item, 'NAME', 0) || '').toString();
      const qty   = num(safeGet(item, 'CLOSINGBALANCE', 0));
      const value = num(safeGet(item, 'CLOSINGVALUE', 0));
      if (name) inventory.push({ itemName: name, closingQty: qty, closingValue: value });
    });
  } catch (e) {
    logger.warn('parseInventoryFromTally: parsing error.', { error: e.message });
  }

  return {
    source: 'tally',
    totalProducts: inventory.length,
    inventory: inventory.sort((a, b) => b.closingValue - a.closingValue),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches Sales data.
 * Tries Tally first; falls back to local data on any error.
 * @param {{ from?: string, to?: string }} dateRange
 */
async function fetchSales(dateRange = {}) {
  try {
    const xml    = buildSalesRegisterRequest(dateRange);
    const raw    = await tallyRequest(xml);
    const parsed = await parseXml(raw);
    const data   = parseSalesFromTally(parsed);
    logger.success('fetchSales: data fetched from Tally.');
    return data;
  } catch (err) {
    logger.warn('fetchSales: Tally unavailable — using local data.', { reason: err.message });
    return localSalesSummary();
  }
}

/**
 * Fetches Dealer/Ledger data.
 */
async function fetchDealers() {
  try {
    const xml    = buildLedgerMasterRequest();
    const raw    = await tallyRequest(xml);
    const parsed = await parseXml(raw);
    const data   = parseLedgersFromTally(parsed);
    logger.success('fetchDealers: data fetched from Tally.');
    return data;
  } catch (err) {
    logger.warn('fetchDealers: Tally unavailable — using local data.', { reason: err.message });
    return localDealerData();
  }
}

/**
 * Fetches Outstanding Receivables.
 */
async function fetchOutstanding() {
  try {
    const xml    = buildOutstandingRequest();
    const raw    = await tallyRequest(xml);
    const parsed = await parseXml(raw);
    const data   = parseOutstandingFromTally(parsed);
    logger.success('fetchOutstanding: data fetched from Tally.');
    return data;
  } catch (err) {
    logger.warn('fetchOutstanding: Tally unavailable — using local data.', { reason: err.message });
    return localOutstandingData();
  }
}

/**
 * Fetches Inventory / Stock Summary.
 */
async function fetchInventory() {
  try {
    const xml    = buildInventoryRequest();
    const raw    = await tallyRequest(xml);
    const parsed = await parseXml(raw);
    const data   = parseInventoryFromTally(parsed);
    logger.success('fetchInventory: data fetched from Tally.');
    return data;
  } catch (err) {
    logger.warn('fetchInventory: Tally unavailable — using local data.', { reason: err.message });
    return localInventoryData();
  }
}

// ─── Live Full-Data Sync ──────────────────────────────────────────────────────

/**
 * Builds a Day Book XML request for ALL vouchers across the full date range
 * that exists in this company. Tally Prime returns data inside IMPORTDATA.
 * @returns {string} XML envelope
 */
function buildLiveSalesRequest() {
  const cfg = require('../config');
  const today = new Date();
  const toDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllVouchersCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${escapeXml(cfg.tally.companyName)}</SVCURRENTCOMPANY>
        <SVFROMDATE>20260401</SVFROMDATE>
        <SVTODATE>${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllVouchersCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes">
            <TYPE>Voucher</TYPE>
            <FETCH>VoucherNumber, Date, VoucherTypeName, PartyLedgerName, Narration, AllLedgerEntries.*</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

/**
 * Parses Tally Prime's actual Day Book XML response into salesData records.
 *
 * VERIFIED Tally Prime XML path (June 2026):
 *   ENVELOPE.BODY[0].DATA[0].COLLECTION[0].VOUCHER[]
 *
 * All sale-specific data is embedded in the NARRATION we wrote during import:
 *   "Item: <name> | Qty: <n> <unit> | Rate: <r> | Area: <a> | SO: <s> | State: <st>"
 *
 * Amount is extracted from ALLLEDGERENTRIES.LIST (abs of first entry = invoice value).
 *
 * @param {Object} parsed  xml2js output
 * @returns {Object[]}
 */
function parseLiveSalesFromTally(parsed) {
  const records = [];
  try {
    const body       = parsed?.ENVELOPE?.BODY?.[0];
    const data       = body?.DATA?.[0];
    const collection = data?.COLLECTION?.[0];
    const vouchers   = collection?.VOUCHER || [];

    vouchers.forEach((v, idx) => {
      try {
        const vchType = (v.VOUCHERTYPENAME?.[0] || '').trim();
        // Only Sales and Credit Note vouchers
        if (!/^(Sales|Credit Note)$/i.test(vchType)) return;

        // Date: YYYYMMDD → YYYY-MM-DD
        const rawDate = v.DATE?.[0]?._ || v.DATE?.[0] || '';
        const date    = rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate;

        const partyName = (v.PARTYLEDGERNAME?.[0]?._ || v.PARTYLEDGERNAME?.[0] || '').trim();
        const vchNo     = (v.VOUCHERNUMBER?.[0]   || `TLY-${idx}`).toString().trim();
        
        const narObj = v.NARRATION?.[0];
        const narration = (typeof narObj === 'string' ? narObj : (narObj?._ || '')).trim();

        // ── Parse narration fields ────────────────────────────────────────────
        // Format A (backend/data.js vouchers): "Item: X | Qty: N Unit | Rate: R | Area: A | SO: S | State: ST"
        // Format B (push_vouchers.py DEMO vouchers): just the product name as narration
        const get = (key) => {
          const m = narration.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'));
          return m ? m[1].trim() : '';
        };

        const isStructured = /Item:/i.test(narration);

        const itemName = isStructured ? get('Item') : narration;  // fallback: full narration = product name
        const qtyStr   = get('Qty');     // e.g. "53 Nos"
        const rateStr  = get('Rate');
        const areaCity = get('Area');
        const salesMan = get('SO');
        const state    = get('State');

        // Qty and units from "53 Nos"
        const qtyParts = qtyStr.split(/\s+/);
        const quantity = Math.abs(parseFloat(qtyParts[0]) || 0);
        const units    = qtyParts.slice(1).join(' ') || '';
        const rate     = parseFloat(rateStr) || 0;

        // Amount from ledger entries
        const ledgers  = v['ALLLEDGERENTRIES.LIST'] || [];
        let amount = 0;
        for (const l of ledgers) {
          const amtObj = l.AMOUNT?.[0];
          const amtStr = typeof amtObj === 'string' ? amtObj : (amtObj?._ || amtObj || '0');
          const a = parseFloat(String(amtStr).replace(/,/g, ''));
          if (a !== 0) { amount = Math.abs(a); break; }
        }
        // Fallback: qty × rate
        if (amount === 0 && quantity > 0 && rate > 0) amount = quantity * rate;

        records.push({
          vchNo,
          date,
          vchType,
          partyName,
          itemName,
          quantity,
          units,
          rate,
          amount,
          salesMan,
          areaCity,
          state,
          stockGroup:       '',
          stockCategory:    '',
          finalOutstanding: 0,
          _source: 'tally',
        });
      } catch (innerErr) {
        logger.warn(`parseLiveSalesFromTally: skipping msg idx=${idx}`, { error: innerErr.message });
      }
    });
  } catch (e) {
    logger.warn('parseLiveSalesFromTally: outer parse error.', { error: e.message });
  }

  logger.info(`parseLiveSalesFromTally: parsed ${records.length} sales records from Tally.`);
  return records;
}

/**
 * Fetches ALL sales vouchers from Tally's Day Book and converts them
 * to the salesData schema used by the dashboard.
 * Returns { salesData: [...], source: 'tally' } or throws on any HTTP/parse error.
 */
async function fetchLiveSalesData() {
  const xml    = buildLiveSalesRequest();
  const raw    = await tallyRequest(xml);
  const parsed = await parseXml(raw);
  const data   = parseLiveSalesFromTally(parsed);
  return { salesData: data, source: 'tally' };
}

module.exports = { fetchSales, fetchDealers, fetchOutstanding, fetchInventory, fetchLiveSalesData };


