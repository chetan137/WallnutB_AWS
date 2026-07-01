/**
 * services/tallyImportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles importing vouchers from data.js into Tally Prime via the XML API.
 *
 * Strategy:
 *  1. Split all transactions into batches (configurable size).
 *  2. POST each batch to Tally.
 *  3. Parse Tally's XML response to extract success/error counts.
 *  4. On duplicate-voucher error (LINEERROR), retry with ACTION="ALTER".
 *  5. Return a structured import result summary.
 *
 * Tally XML response shape (on success):
 *  <ENVELOPE>
 *    <BODY>
 *      <DATA>
 *        <RESPONSE>1 Voucher(s) Created</RESPONSE>
 *      </DATA>
 *    </BODY>
 *  </ENVELOPE>
 *
 * Tally XML response shape (on error):
 *  <ENVELOPE>
 *    <BODY>
 *      <DATA>
 *        <LINEERROR>Duplicate Voucher Number</LINEERROR>
 *      </DATA>
 *    </BODY>
 *  </ENVELOPE>
 */

'use strict';

const axios = require('axios');

const config      = require('../config');
const logger      = require('../utils/logger');
const { salesData } = require('../data');
const {
  buildVoucherXml,
  buildImportEnvelope,
} = require('../utils/xmlGenerator');

// ─── Constants ────────────────────────────────────────────────────────────────
const BATCH_SIZE = 50; // vouchers per HTTP request to Tally

// ─── XML Parsing Helper ────────────────────────────────────────────────────────

/**
 * Parses Tally Prime's actual XML response into a counts object.
 *
 * Tally Prime returns (verified by live testing):
 *   <RESPONSE>
 *     <CREATED>1</CREATED>  <ALTERED>0</ALTERED>  <DELETED>0</DELETED>
 *     <ERRORS>0</ERRORS>    <EXCEPTIONS>0</EXCEPTIONS>  <IGNORED>0</IGNORED>
 *   </RESPONSE>
 *
 * @param {string} raw  Raw response text from Tally
 * @returns {{ created: number, altered: number, errors: number, exceptions: number, ignored: number, raw: string }}
 */
function parseTallyResponse(raw) {
  const str = String(raw);
  const num = (tag) => {
    const m = str.match(new RegExp(`<${tag}>(\\d+)<\/${tag}>`, 'i'));
    return m ? parseInt(m[1], 10) : 0;
  };

  return {
    created:    num('CREATED'),
    altered:    num('ALTERED'),
    errors:     num('ERRORS'),
    exceptions: num('EXCEPTIONS'),
    ignored:    num('IGNORED'),
    raw:        str,
  };
}

/**
 * Converts parsed Tally counts into our internal { responses, errors } shape.
 * @param {ReturnType<typeof parseTallyResponse>} parsed
 * @returns {{ responses: string[], errors: string[], isDuplicate: boolean }}
 */
function extractResponseMessages(parsed) {
  const responses = [];
  const errors    = [];

  if (parsed.created > 0) {
    responses.push(`Created: ${parsed.created} voucher(s)`);
  }
  if (parsed.altered > 0) {
    responses.push(`Altered: ${parsed.altered} voucher(s)`);
  }
  if (parsed.ignored > 0) {
    // IGNORED usually means duplicate — Tally skipped it silently
    errors.push(`Duplicate: ${parsed.ignored} voucher(s) ignored (already exist)`);
  }
  if (parsed.exceptions > 0) {
    errors.push(`Exceptions: ${parsed.exceptions} (missing ledger/stock item — run createMasterData.js first)`);
  }
  if (parsed.errors > 0) {
    errors.push(`Errors: ${parsed.errors} (check Tally error log)`);
  }

  return { responses, errors, isDuplicate: parsed.ignored > 0 };
}

// ─── Core Import Logic ────────────────────────────────────────────────────────

/**
 * Posts a single XML batch to Tally and returns parsed results.
 * @param {string} xml  Full ENVELOPE XML
 * @param {number} attempt  1 = CREATE, 2 = ALTER (duplicate retry)
 * @returns {Promise<{ responses: string[], errors: string[] }>}
 */
async function postToTally(xml, attempt = 1) {
  const url = config.tally.baseUrl;
  try {
    const response = await axios.post(url, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: config.tally.timeout,
    });

    const parsed = parseTallyResponse(response.data);
    logger.debug(`Tally raw response (attempt ${attempt}): C=${parsed.created} A=${parsed.altered} E=${parsed.errors} X=${parsed.exceptions} I=${parsed.ignored}`);
    return extractResponseMessages(parsed);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`Tally Prime is not running on ${url}. Please start Tally and enable the XML server on port ${config.tally.port}.`);
    }
    throw err;
  }
}

/**
 * Checks whether a set of errors indicates a duplicate voucher number.
 * @param {string[]} errors
 * @returns {boolean}
 */
function hasDuplicateError(errors) {
  return errors.some((e) =>
    /duplicate/i.test(e) || /already exists/i.test(e) ||
    /voucher number/i.test(e) || /ignored/i.test(e)
  );
}

// ─── Batch Processing ─────────────────────────────────────────────────────────

/**
 * Imports one batch of transactions.  On duplicate error, retries with ALTER.
 * @param {Object[]} batch   Array of transaction objects
 * @param {number} batchIndex
 * @returns {Promise<{ imported: number, duplicates: number, failed: number, details: string[] }>}
 */
async function importBatch(batch, batchIndex) {
  const result = { imported: 0, duplicates: 0, failed: 0, details: [] };

  // ── First attempt: CREATE ──────────────────────────────────────────────────
  let messages = batch.map((txn) => buildVoucherXml(txn, 'CREATE'));
  let envelope = buildImportEnvelope(messages);

  logger.info(`Batch ${batchIndex}: Sending ${batch.length} vouchers (CREATE)…`);

  let { responses, errors } = await postToTally(envelope, 1);

  if (errors.length === 0) {
    // All created successfully
    result.imported += batch.length;
    result.details.push(...responses);
    logger.success(`Batch ${batchIndex}: ✔ ${batch.length} vouchers imported.`);
    return result;
  }

  if (hasDuplicateError(errors)) {
    logger.warn(`Batch ${batchIndex}: Duplicate voucher(s) detected — retrying with ALTER…`);

    // ── Retry: ALTER (update existing) ────────────────────────────────────────
    messages = batch.map((txn) => buildVoucherXml(txn, 'ALTER'));
    envelope = buildImportEnvelope(messages);
    ({ responses, errors } = await postToTally(envelope, 2));

    if (errors.length === 0) {
      result.duplicates += batch.length;
      result.details.push(...responses, `[ALTER] Batch ${batchIndex} updated ${batch.length} existing vouchers.`);
      logger.success(`Batch ${batchIndex}: ✔ ${batch.length} vouchers updated (ALTER).`);
    } else {
      result.failed += errors.length;
      result.details.push(...errors);
      logger.error(`Batch ${batchIndex}: ${errors.length} voucher(s) failed even after ALTER.`, { errors });
    }
  } else {
    // Non-duplicate error
    result.failed += errors.length;
    result.details.push(...errors);
    logger.error(`Batch ${batchIndex}: ${errors.length} error(s).`, { errors });
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Imports ALL vouchers from data.js into Tally Prime.
 * Processes in batches, collects summary, and returns a full import report.
 *
 * @returns {Promise<{
 *   totalRecords: number,
 *   imported: number,
 *   duplicates: number,
 *   failed: number,
 *   batches: number,
 *   durationMs: number,
 *   details: string[]
 * }>}
 */
async function importAllVouchers() {
  const startTime = Date.now();
  const transactions = salesData;

  logger.info(`Starting Tally import: ${transactions.length} records in batches of ${BATCH_SIZE}…`);

  const summary = {
    totalRecords: transactions.length,
    imported:   0,
    duplicates: 0,
    failed:     0,
    batches:    0,
    durationMs: 0,
    details:    [],
  };

  // Slice into batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    summary.batches++;

    try {
      const batchResult = await importBatch(batch, summary.batches);
      summary.imported   += batchResult.imported;
      summary.duplicates += batchResult.duplicates;
      summary.failed     += batchResult.failed;
      summary.details.push(...batchResult.details);
    } catch (err) {
      logger.error(`Batch ${summary.batches} threw an unhandled error.`, { message: err.message });
      summary.failed += batch.length;
      summary.details.push(`[BATCH ERROR] ${err.message}`);
    }
  }

  summary.durationMs = Date.now() - startTime;

  logger.info('Import complete.', {
    imported:   summary.imported,
    duplicates: summary.duplicates,
    failed:     summary.failed,
    durationMs: summary.durationMs,
  });

  return summary;
}

/**
 * Imports a single voucher by its vchNo.
 * Useful for re-importing a specific record after a fix.
 *
 * @param {string} vchNo
 * @returns {Promise<Object>}
 */
async function importSingleVoucher(vchNo) {
  const txn = salesData.find((r) => r.vchNo === vchNo);
  if (!txn) {
    throw new Error(`Voucher ${vchNo} not found in data.js`);
  }
  return importBatch([txn], 1);
}

module.exports = { importAllVouchers, importSingleVoucher };
