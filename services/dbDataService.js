/**
 * services/dbDataService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads dashboard data from PostgreSQL (populated by the separate `tallybackend`
 * sync service running on the Antraweb VM — see tally_sync_architecture.md).
 *
 * This module only ever SELECTs. All writes happen on the VM's sync service.
 *
 * Every function returns records shaped exactly like backend/data.js's
 * `salesData` rows, so the same `summarize*` aggregations used for local/demo
 * data work unchanged here — see utils/salesAggregations.js.
 */

'use strict';

const { query } = require('../db/pool');
const { resolveCompanyId } = require('../db/companies');
const config = require('../config');
const { createTtlCache } = require('../utils/cache');
const {
  summarizeSales,
  summarizeDealers,
  summarizeOutstanding,
  summarizeInventory,
} = require('../utils/salesAggregations');

const cache = createTtlCache();

/**
 * Flat sales rows — one per (voucher, inventory line) — matching the
 * frontend's salesData record shape exactly.
 *
 * Notes on the joins/filters:
 *  • voucher_inventory_entries is LEFT JOINed (not INNER) so a voucher with
 *    no synced line item (e.g. a service invoice, or a sync-timing gap)
 *    still contributes one row using the voucher's own total_amount —
 *    otherwise its revenue would silently disappear from every KPI total.
 *  • stock_items only tracks one group level (parent_group), so stockGroup
 *    and stockCategory both map to it — the schema has no second tier.
 *  • finalOutstanding comes from bills_receivable by matching
 *    bill_ref = vch_no. Tally defaults a bill's "New Ref" to the voucher
 *    number, but it can be manually overridden — verify this join once real
 *    data is connected; if bill references diverge from voucher numbers,
 *    outstanding figures here will read low.
 *  • vch_type is matched with LIKE 'sales%' / 'credit note%', not an exact
 *    match — this Tally setup names vouchers per branch, e.g.
 *    "Sales-Bhiwandi" / "Sales - Kolhapur" / "Credit Note-Kolhapur", never
 *    the bare "Sales" the schema doc used as an example.
 *  • No company_id filter by default (only applied when the caller passes
 *    one explicitly). Real vouchers currently live entirely under the
 *    *historical* company (last FY) — the active FY company has no sales
 *    synced yet — so restricting to "the active company" would show nothing
 *    despite real data existing. Aggregating across every synced company
 *    also matches the cross-FY queries tally_sync_architecture.md describes.
 *  • state falls back to the party's ledger master (`ledgers.state`, keyed
 *    by GST registration — ~90% populated) when the voucher's own narration
 *    has none. Verified against real data: this Tally setup's narrations are
 *    free text written by accountants ("Being Material send to..."), not the
 *    structured "Item: X | Area: Y | State: Z" format the sync parser looks
 *    for, so vie.state/area_city/sales_officer are empty for every real
 *    voucher — there's no district/officer source anywhere in the synced
 *    schema, only state (via the ledger). District/officer-scoped dashboard
 *    views will stay empty for real data until that's addressed upstream.
 */
async function fetchSalesRecords({ from, to, companyId } = {}) {
  const params = [];
  let companyFilter = '';
  if (companyId) {
    const cid = await resolveCompanyId(companyId);
    params.push(cid);
    companyFilter = ` AND v.company_id = $${params.length}`;
  }

  let dateFilter = '';
  if (from) { params.push(from); dateFilter += ` AND v.date >= $${params.length}`; }
  if (to)   { params.push(to);   dateFilter += ` AND v.date <= $${params.length}`; }

  const { rows } = await query(`
    SELECT
      v.vch_no                                        AS "vchNo",
      v.date                                           AS "date",
      v.vch_type                                       AS "vchType",
      v.party_name                                     AS "partyName",
      vie.item_name                                    AS "itemName",
      COALESCE(vie.quantity, 0)                        AS "quantity",
      vie.unit                                         AS "units",
      COALESCE(vie.rate, 0)                            AS "rate",
      COALESCE(vie.amount, v.total_amount)             AS "amount",
      COALESCE(vie.sales_officer, '')                  AS "salesMan",
      COALESCE(vie.area_city, '')                      AS "areaCity",
      COALESCE(NULLIF(vie.state, ''), l.state, '')     AS "state",
      COALESCE(si.parent_group, '')                    AS "stockGroup",
      COALESCE(si.parent_group, '')                    AS "stockCategory",
      COALESCE(br.amount, 0)                           AS "finalOutstanding"
    FROM vouchers v
    LEFT JOIN voucher_inventory_entries vie ON vie.voucher_id = v.id
    LEFT JOIN stock_items si
      ON si.company_id = v.company_id AND si.name = vie.item_name
    LEFT JOIN bills_receivable br
      ON br.company_id = v.company_id AND br.party_name = v.party_name AND br.bill_ref = v.vch_no
    LEFT JOIN ledgers l
      ON l.company_id = v.company_id AND l.name = v.party_name
    WHERE v.is_cancelled = false
      AND (LOWER(v.vch_type) LIKE 'sales%' OR LOWER(v.vch_type) LIKE 'credit note%')
      ${companyFilter}
      ${dateFilter}
    ORDER BY v.date DESC
  `, params);

  return rows;
}

/**
 * Full flat array for /api/tally/data and /api/tally/sync — cached for
 * config.cacheTtlMs so repeated dashboard loads don't hammer the VM's
 * Postgres. Pass bypassCache when the user explicitly hits "Sync".
 */
async function fetchLiveSalesData({ companyId, bypassCache = false } = {}) {
  const key = `live-sales:${companyId || 'default'}`;
  const load = () => fetchSalesRecords({ companyId });
  const salesData = bypassCache ? await load() : await cache.wrap(key, config.cacheTtlMs, load);
  return { salesData, source: 'db' };
}

async function fetchSales({ from, to, companyId } = {}) {
  const records = await fetchSalesRecords({ from, to, companyId });
  return summarizeSales(records, 'db');
}

async function fetchDealers({ companyId } = {}) {
  const records = await fetchSalesRecords({ companyId });
  return summarizeDealers(records, 'db');
}

async function fetchOutstanding({ companyId } = {}) {
  const records = await fetchSalesRecords({ companyId });
  return summarizeOutstanding(records, 'db');
}

async function fetchInventory({ companyId } = {}) {
  const records = await fetchSalesRecords({ companyId });
  return summarizeInventory(records, 'db');
}

/**
 * Vendor-wise payables — the mirror of fetchOutstanding, but money the
 * company owes rather than is owed. Sourced from outstanding_payables
 * (party totals) plus an aging breakdown from bills_payable (bill-level,
 * with overdue_days already computed by the sync engine).
 */
async function fetchPayables({ companyId } = {}) {
  const params = [];
  let companyFilter = '';
  if (companyId) {
    const cid = await resolveCompanyId(companyId);
    params.push(cid);
    companyFilter = ` AND company_id = $${params.length}`;
  }

  const { rows: parties } = await query(`
    SELECT party_name AS "partyName", SUM(amount_payable) AS "amountPayable"
    FROM outstanding_payables
    WHERE 1=1 ${companyFilter}
    GROUP BY party_name
    ORDER BY "amountPayable" DESC
  `, params);

  const { rows: aging } = await query(`
    SELECT
      CASE
        WHEN overdue_days <= 0  THEN 'Not Due'
        WHEN overdue_days <= 30 THEN '1-30 days'
        WHEN overdue_days <= 60 THEN '31-60 days'
        WHEN overdue_days <= 90 THEN '61-90 days'
        ELSE '90+ days'
      END AS bucket,
      COUNT(*) AS "billCount",
      SUM(amount) AS "amount"
    FROM bills_payable
    WHERE 1=1 ${companyFilter}
    GROUP BY 1
  `, params);

  const bucketOrder = ['Not Due', '1-30 days', '31-60 days', '61-90 days', '90+ days'];

  return {
    source: 'db',
    totalPayable: parties.reduce((s, p) => s + p.amountPayable, 0),
    totalVendors: parties.length,
    payables: parties,
    aging: aging.sort((a, b) => bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket)),
  };
}

/**
 * Cash Flow (Receipts & Payments), one summary per company.
 *
 * trial_balance_groups/pl_items/cash_flow_items are snapshot tables — the
 * sync engine inserts a fresh row set every run rather than replacing the
 * old one (period_to advances to "today" each time), so multiple sync runs
 * leave multiple overlapping snapshots per company. Summing across all of
 * them double/triple-counts everything — verified live: it inflated one
 * company's cash inflow from a real ~₹14 Cr to a nonsense ~₹55 Cr. Always
 * scope to MAX(period_to) per company to use only the latest snapshot.
 */
async function fetchCashFlow({ companyId } = {}) {
  const params = [];
  let companyFilter = '';
  if (companyId) {
    const cid = await resolveCompanyId(companyId);
    params.push(cid);
    companyFilter = ` AND cfi.company_id = $${params.length}`;
  }

  const { rows } = await query(`
    SELECT cfi.company_id AS "companyId", c.name AS "companyName",
           cfi.item_name AS "itemName", cfi.main_amount AS "amount",
           cfi.period_from AS "periodFrom", cfi.period_to AS "periodTo"
    FROM cash_flow_items cfi
    JOIN (SELECT company_id, MAX(period_to) AS max_to FROM cash_flow_items GROUP BY company_id) latest
      ON latest.company_id = cfi.company_id AND latest.max_to = cfi.period_to
    JOIN companies c ON c.id = cfi.company_id
    WHERE 1=1 ${companyFilter}
    ORDER BY cfi.company_id, cfi.main_amount DESC
  `, params);

  const byCompany = {};
  for (const r of rows) {
    if (!byCompany[r.companyId]) {
      byCompany[r.companyId] = {
        companyId: r.companyId,
        companyName: r.companyName,
        periodFrom: r.periodFrom,
        periodTo: r.periodTo,
        inflow: 0,
        outflow: 0,
        lineItems: [],
      };
    }
    const c = byCompany[r.companyId];
    if (r.amount > 0) c.inflow += r.amount; else c.outflow += r.amount;
    c.lineItems.push({ itemName: r.itemName, amount: r.amount });
  }

  const companies = Object.values(byCompany).map((c) => ({ ...c, netCashFlow: c.inflow + c.outflow }));

  return { source: 'db', companies };
}

/**
 * P&L (pl_items) and Balance Sheet (trial_balance_groups) per company —
 * the AUTHORITATIVE totals per tally_sync_architecture.md, independent of
 * whether individual sales vouchers were fully synced. Same latest-snapshot
 * caveat as fetchCashFlow applies to trial_balance_groups.
 */
async function fetchFinancials({ companyId } = {}) {
  const params = [];
  let companyFilter = '';
  if (companyId) {
    const cid = await resolveCompanyId(companyId);
    params.push(cid);
    companyFilter = ` AND pl.company_id = $${params.length}`;
  }

  const { rows: plRows } = await query(`
    SELECT pl.company_id AS "companyId", c.name AS "companyName",
           pl.group_name AS "groupName", pl.main_amount AS "amount",
           pl.period_from AS "periodFrom", pl.period_to AS "periodTo"
    FROM pl_items pl
    JOIN (SELECT company_id, MAX(period_to) AS max_to FROM pl_items GROUP BY company_id) latest
      ON latest.company_id = pl.company_id AND latest.max_to = pl.period_to
    JOIN companies c ON c.id = pl.company_id
    WHERE 1=1 ${companyFilter}
    ORDER BY pl.company_id, pl.main_amount DESC
  `, params);

  const bsParams = [];
  let bsCompanyFilter = '';
  if (companyId) {
    bsParams.push(await resolveCompanyId(companyId));
    bsCompanyFilter = ` AND tbg.company_id = $${bsParams.length}`;
  }

  const { rows: bsRows } = await query(`
    SELECT tbg.company_id AS "companyId", tbg.group_name AS "groupName", tbg.net_balance AS "netBalance"
    FROM trial_balance_groups tbg
    JOIN (SELECT company_id, MAX(period_to) AS max_to FROM trial_balance_groups GROUP BY company_id) latest
      ON latest.company_id = tbg.company_id AND latest.max_to = tbg.period_to
    WHERE tbg.group_name IN ('Current Assets', 'Current Liabilities', 'Fixed Assets', 'Capital Account', 'Loans (Liability)')
      ${bsCompanyFilter}
  `, bsParams);

  const byCompany = {};
  for (const r of plRows) {
    if (!byCompany[r.companyId]) {
      byCompany[r.companyId] = {
        companyId: r.companyId,
        companyName: r.companyName,
        periodFrom: r.periodFrom,
        periodTo: r.periodTo,
        pl: { revenue: 0, costOfSales: 0, netProfit: 0, lineItems: [] },
        balanceSheet: { currentAssets: 0, currentLiabilities: 0, fixedAssets: 0, capitalAccount: 0, loans: 0 },
      };
    }
    const entry = byCompany[r.companyId];
    entry.pl.lineItems.push({ groupName: r.groupName, amount: r.amount });
    entry.pl.netProfit += r.amount;
    if (r.groupName === 'Sales Accounts')  entry.pl.revenue     = r.amount;
    if (r.groupName === 'Cost of Sales :') entry.pl.costOfSales = r.amount;
  }
  for (const entry of Object.values(byCompany)) {
    entry.pl.grossProfit = entry.pl.revenue + entry.pl.costOfSales; // costOfSales is already negative
  }

  const bsFieldByGroup = {
    'Current Assets':      'currentAssets',
    'Current Liabilities': 'currentLiabilities',
    'Fixed Assets':        'fixedAssets',
    'Capital Account':     'capitalAccount',
    'Loans (Liability)':   'loans',
  };
  // Assets carry a debit balance, so net_balance stores them negative under
  // Tally's Cr-positive/Dr-negative convention (see schema.sql). A balance
  // sheet always presents assets as positive figures, so flip sign here —
  // liabilities/equity are already Cr-positive and need no adjustment.
  const ASSET_FIELDS = new Set(['currentAssets', 'fixedAssets']);
  for (const r of bsRows) {
    const entry = byCompany[r.companyId];
    if (!entry) continue;
    const field = bsFieldByGroup[r.groupName];
    entry.balanceSheet[field] = ASSET_FIELDS.has(field) ? Math.abs(r.netBalance) : r.netBalance;
  }

  return { source: 'db', companies: Object.values(byCompany) };
}

module.exports = {
  fetchSalesRecords,
  fetchLiveSalesData,
  fetchSales,
  fetchDealers,
  fetchOutstanding,
  fetchInventory,
  fetchPayables,
  fetchCashFlow,
  fetchFinancials,
};
