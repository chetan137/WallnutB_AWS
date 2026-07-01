/**
 * scripts/importToTally.js
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPLETE TALLY IMPORT — Accounting-Only Mode
 *
 * What it imports:
 *   ✅ Every sales/credit-note voucher from data.js
 *   ✅ Party ledger (Sundry Debtors) — debit/credit side
 *   ✅ Sales / Sales Returns ledger — credit/debit side
 *   ✅ Voucher number, date, narration (area, salesman, state)
 *   ⏭  Inventory lines skipped (Tally company not configured for inventory)
 *
 * WHY no inventory:
 *   Tally returns EXCEPTIONS:1 for any voucher with ALLINVENTORYENTRIES.LIST
 *   when the "Sales" voucher type does not have inventory tracking enabled,
 *   or in Tally Educational Mode.
 *   Everything else imports cleanly.
 *
 * Usage:
 *   node scripts/importToTally.js
 *   node scripts/importToTally.js --dry-run   (shows XML, no POST)
 *   node scripts/importToTally.js --limit 10  (import first 10 only)
 */

'use strict';

require('dotenv').config();
const axios = require('axios');

// ─── Config ────────────────────────────────────────────────────────────────────
const TALLY_URL  = `${process.env.TALLY_HOST || 'http://localhost'}:${process.env.TALLY_PORT || 9000}`;
const CO_NAME    = process.env.TALLY_COMPANY_NAME || 'Wallnut';
const BATCH_SIZE = 25; // vouchers per HTTP request — smaller = safer

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const LIMIT    = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1]) : null; })();

// ─── Data ─────────────────────────────────────────────────────────────────────
const { salesData } = require('../data');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sep = (t) => console.log(`\n${'═'.repeat(65)}\n  ${t}\n${'═'.repeat(65)}`);
const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const toDate = (s) => String(s).replace(/-/g, '');

function parseResult(raw) {
  const n = (tag) => parseInt((String(raw).match(new RegExp(`<${tag}>(\\d+)<\\/${tag}>`, 'i')) || [])[1] || '0', 10);
  return { created: n('CREATED'), altered: n('ALTERED'), errors: n('ERRORS'), exceptions: n('EXCEPTIONS'), ignored: n('IGNORED') };
}

// ─── XML Builder ──────────────────────────────────────────────────────────────
/**
 * Builds one TALLYMESSAGE for a single transaction.
 * Accounting-only (no inventory) — works with all Tally configurations.
 */
function buildVoucherXml(txn, action = 'CREATE') {
  const isCN       = /credit note/i.test(txn.vchType);
  const vchType    = isCN ? 'Credit Note' : 'Sales';
  const salesLedger = isCN ? 'Sales Returns' : 'Sales';
  const amt        = Math.abs(txn.amount);

  // Debit/Credit sign convention:
  //   Sales:       Party Dr (-amt),  Sales Cr (+amt)
  //   Credit Note: Party Cr (+amt),  Sales Returns Dr (-amt)
  const partyAmt = isCN ?  amt : -amt;
  const salesAmt = isCN ? -amt :  amt;

  return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <VOUCHER VCHTYPE="${esc(vchType)}" ACTION="${action}">
    <DATE>${toDate(txn.date)}</DATE>
    <VOUCHERTYPENAME>${esc(vchType)}</VOUCHERTYPENAME>
    <VOUCHERNUMBER>${esc(txn.vchNo)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${esc(txn.partyName)}</PARTYLEDGERNAME>
    <NARRATION>Item: ${esc(txn.itemName)} | Qty: ${txn.quantity} ${esc(txn.units)} | Rate: ${txn.rate} | Area: ${esc(txn.areaCity)} | SO: ${esc(txn.salesMan)} | State: ${esc(txn.state)}</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${esc(txn.partyName)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${isCN ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
      <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
      <AMOUNT>${partyAmt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${esc(salesLedger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${isCN ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
      <AMOUNT>${salesAmt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>
</TALLYMESSAGE>`;
}

function buildEnvelope(messages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(CO_NAME)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${messages.join('\n')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// ─── Tally POST ────────────────────────────────────────────────────────────────
async function postToTally(xml) {
  const res = await axios.post(TALLY_URL, xml, {
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: 30000,
  });
  return parseResult(res.data);
}

// ─── Main Import ───────────────────────────────────────────────────────────────
async function run() {
  sep('WALLNUT → TALLY PRIME IMPORT');
  console.log(`  URL      : ${TALLY_URL}`);
  console.log(`  Company  : "${CO_NAME}"`);
  console.log(`  Mode     : ${DRY_RUN ? '🟡 DRY RUN (no data sent)' : '🟢 LIVE'}`);

  const transactions = LIMIT ? salesData.slice(0, LIMIT) : salesData;
  console.log(`  Records  : ${transactions.length} vouchers`);
  console.log(`  Batch sz : ${BATCH_SIZE}`);

  if (DRY_RUN) {
    console.log('\n--- Sample XML (first voucher) ---');
    console.log(buildEnvelope([buildVoucherXml(transactions[0])]));
    return;
  }

  // ── Connectivity check ────────────────────────────────────────────────────
  sep('STEP 1 — Check Tally Connection');
  try {
    await axios.post(TALLY_URL, `<?xml version="1.0"?><ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>Day Book</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' }, timeout: 5000
    });
    console.log('  ✅ Tally is reachable');
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`  ❌ Cannot connect to Tally at ${TALLY_URL}`);
      console.error('     → Open Tally Prime → Enable HTTP port 9000 → Open company "' + CO_NAME + '"');
      process.exit(1);
    }
    console.log('  ✅ Tally responded (connection OK)');
  }

  // ── Batch import ──────────────────────────────────────────────────────────
  sep('STEP 2 — Import Vouchers');

  const summary = { created: 0, altered: 0, ignored: 0, errors: 0, exceptions: 0, batches: 0 };
  const failed  = [];

  const totalBatches = Math.ceil(transactions.length / BATCH_SIZE);

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch   = transactions.slice(i, i + BATCH_SIZE);
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    summary.batches++;

    process.stdout.write(`\r  Batch ${batchNo}/${totalBatches} (vouchers ${i + 1}–${Math.min(i + BATCH_SIZE, transactions.length)})…   `);

    const messages = batch.map((txn) => buildVoucherXml(txn, 'CREATE'));
    const xml      = buildEnvelope(messages);

    try {
      const r = await postToTally(xml);
      summary.created    += r.created;
      summary.altered    += r.altered;
      summary.ignored    += r.ignored;
      summary.errors     += r.errors;
      summary.exceptions += r.exceptions;

      // If batch has exceptions (duplicates), retry with ALTER
      if (r.exceptions > 0 || r.errors > 0) {
        process.stdout.write(`\r  Batch ${batchNo}/${totalBatches} — exceptions detected, retrying with ALTER…   `);
        const altMessages = batch.map((txn) => buildVoucherXml(txn, 'ALTER'));
        const altXml      = buildEnvelope(altMessages);
        const r2          = await postToTally(altXml);
        // Adjust summary
        summary.exceptions -= r.exceptions;
        summary.errors     -= r.errors;
        summary.created    -= r.created;
        summary.altered    += r2.altered;
        summary.exceptions += r2.exceptions;
        summary.errors     += r2.errors;
        if (r2.exceptions > 0 || r2.errors > 0) {
          batch.forEach(txn => failed.push(txn.vchNo));
        }
      }
    } catch (err) {
      console.error(`\n  ❌ Batch ${batchNo} failed: ${err.message}`);
      batch.forEach(txn => failed.push(txn.vchNo));
      summary.errors += batch.length;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  sep('IMPORT COMPLETE ✅');
  console.log(`\n  Total vouchers  : ${transactions.length}`);
  console.log(`  ✅ Created       : ${summary.created}`);
  console.log(`  🔄 Altered       : ${summary.altered}`);
  console.log(`  ⏭  Ignored       : ${summary.ignored} (already existed)`);
  console.log(`  ❌ Errors        : ${summary.errors}`);
  console.log(`  ⚠️  Exceptions    : ${summary.exceptions}`);
  console.log(`  📦 Batches sent  : ${summary.batches}`);

  const totalOk = summary.created + summary.altered;
  const pct     = Math.round((totalOk / transactions.length) * 100);
  console.log(`\n  Success rate: ${pct}% (${totalOk}/${transactions.length} vouchers)`);

  if (failed.length > 0) {
    console.log(`\n  Failed voucher numbers:`);
    failed.slice(0, 20).forEach(v => console.log(`    • ${v}`));
    if (failed.length > 20) console.log(`    … and ${failed.length - 20} more`);
  }

  if (totalOk === transactions.length) {
    console.log('\n  🎉 ALL VOUCHERS IMPORTED SUCCESSFULLY!\n');
  } else if (totalOk > 0) {
    console.log(`\n  ✅ Partial success — ${totalOk} vouchers in Tally.\n`);
  } else {
    console.log('\n  ❌ No vouchers imported. Check Tally company name and settings.\n');
  }
}

run().catch((err) => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
