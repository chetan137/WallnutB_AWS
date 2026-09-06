/**
 * db/companies.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves which `companies.id` row the dashboard should read from.
 *
 * config.defaultCompanyId (DEFAULT_COMPANY_ID env var) pins a specific company.
 * Left empty, we auto-pick the newest non-historical *active* company — i.e.
 * the live FY that tallybackend's sync engine keeps up to date every 10 min.
 */

'use strict';

const config = require('../config');
const { query } = require('./pool');

let cachedId = null;
let cachedAt = 0;
const AUTO_PICK_CACHE_MS = 60_000; // companies table changes rarely — safe to cache briefly

/**
 * @param {number|string} [override] Explicit company id (e.g. from a ?companyId= query param).
 * @returns {Promise<number>}
 */
async function resolveCompanyId(override) {
  if (override) return Number(override);
  if (config.defaultCompanyId) return config.defaultCompanyId;

  const now = Date.now();
  if (cachedId && now - cachedAt < AUTO_PICK_CACHE_MS) return cachedId;

  const { rows } = await query(`
    SELECT id FROM companies
    WHERE is_active = true AND is_historical = false
    ORDER BY fiscal_year_from DESC NULLS LAST, id DESC
    LIMIT 1
  `);

  if (!rows.length) {
    throw new Error('No active, non-historical company found in the companies table.');
  }

  cachedId = rows[0].id;
  cachedAt = now;
  return cachedId;
}

/**
 * Lists every synced company for a UI filter dropdown — e.g. Financials page
 * "which company" selector, so a user can choose one company instead of the
 * default combined-across-all-companies view.
 * @returns {Promise<Array<{id: number, name: string, isHistorical: boolean}>>}
 */
async function listCompanies() {
  const { rows } = await query(`
    SELECT id, name, is_historical AS "isHistorical"
    FROM companies
    ORDER BY fiscal_year_from DESC NULLS LAST, id DESC
  `);
  return rows;
}

module.exports = { resolveCompanyId, listCompanies };
