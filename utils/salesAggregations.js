/**
 * utils/salesAggregations.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure aggregation functions shared by every data source (local demo data,
 * live Tally fetch, and Postgres).
 *
 * Each function takes a flat array of salesData-shaped records —
 *   { vchNo, date, vchType, partyName, itemName, quantity, units, rate,
 *     amount, salesMan, areaCity, stockGroup, stockCategory,
 *     finalOutstanding, state }
 * — and returns the exact response shape the dashboard API endpoints expose.
 *
 * Keeping this logic source-agnostic means /sales, /dealers, /outstanding and
 * /inventory behave identically no matter whether the records came from
 * data.js, a live Tally fetch, or a Postgres query.
 */

'use strict';

/** GET /api/tally/sales response shape. */
function summarizeSales(records, source = 'local') {
  const monthly = {};
  const byState = {};
  const byOfficer = {};
  const byProduct = {};

  records.forEach((r) => {
    const ym = r.date.slice(0, 7); // "YYYY-MM"

    if (!monthly[ym]) monthly[ym] = { month: ym, revenue: 0, txnCount: 0, qty: 0 };
    monthly[ym].revenue  += r.amount;
    monthly[ym].txnCount += 1;
    monthly[ym].qty      += r.quantity;

    if (!byState[r.state]) byState[r.state] = { state: r.state, revenue: 0, txnCount: 0 };
    byState[r.state].revenue  += r.amount;
    byState[r.state].txnCount += 1;

    if (!byOfficer[r.salesMan]) byOfficer[r.salesMan] = { name: r.salesMan, district: r.areaCity, state: r.state, revenue: 0, txnCount: 0 };
    byOfficer[r.salesMan].revenue  += r.amount;
    byOfficer[r.salesMan].txnCount += 1;

    if (!byProduct[r.itemName]) byProduct[r.itemName] = { name: r.itemName, category: r.stockCategory, revenue: 0, qty: 0 };
    byProduct[r.itemName].revenue += r.amount;
    byProduct[r.itemName].qty     += r.quantity;
  });

  const totalRevenue = records.reduce((s, r) => s + r.amount, 0);

  return {
    source,
    totalRevenue,
    totalTransactions: records.length,
    monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
    byState: Object.values(byState).sort((a, b) => b.revenue - a.revenue),
    byOfficer: Object.values(byOfficer).sort((a, b) => b.revenue - a.revenue),
    byProduct: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue),
    recentVouchers: records.slice(0, 20).map((r) => ({
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

/** GET /api/tally/dealers response shape. */
function summarizeDealers(records, source = 'local') {
  const dealerStats = {};

  records.forEach((r) => {
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
    d.totalRevenue     += r.amount;
    d.totalOutstanding += r.finalOutstanding;
    d.txnCount         += 1;
    if (r.date > d.lastTransactionDate) d.lastTransactionDate = r.date;
  });

  return {
    source,
    totalDealers: Object.keys(dealerStats).length,
    dealers: Object.values(dealerStats).sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
}

/** GET /api/tally/outstanding response shape. */
function summarizeOutstanding(records, source = 'local') {
  const partyOutstanding = {};

  records.forEach((r) => {
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
    p.totalBilled       += r.amount;
    p.invoiceCount       += 1;
    if (r.date < p.oldestDueDate) p.oldestDueDate = r.date;
  });

  const list = Object.values(partyOutstanding).sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  return {
    source,
    totalOutstanding: list.reduce((s, p) => s + p.totalOutstanding, 0),
    totalParties: list.length,
    outstanding: list,
  };
}

/** GET /api/tally/inventory response shape (product-performance view, derived from sales lines). */
function summarizeInventory(records, source = 'local') {
  const items = {};

  records.forEach((r) => {
    if (!items[r.itemName]) {
      items[r.itemName] = {
        itemName: r.itemName,
        stockGroup: r.stockGroup,
        stockCategory: r.stockCategory,
        unit: r.units,
        totalQty: 0,
        totalRevenue: 0,
        txnCount: 0,
      };
    }
    const item = items[r.itemName];
    item.totalQty     += r.quantity;
    item.totalRevenue += r.amount;
    item.txnCount     += 1;
  });

  const inventory = Object.values(items).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    source,
    totalProducts: inventory.length,
    inventory,
  };
}

module.exports = { summarizeSales, summarizeDealers, summarizeOutstanding, summarizeInventory };
