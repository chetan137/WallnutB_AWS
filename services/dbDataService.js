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

module.exports = {
  fetchSalesRecords,
  fetchLiveSalesData,
  fetchSales,
  fetchDealers,
  fetchOutstanding,
  fetchInventory,
};
