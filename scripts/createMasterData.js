/**
 * scripts/createMasterData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTO-CREATE all required Tally master data before importing vouchers:
 *
 *   1. Ledger for each unique party (under Sundry Debtors)
 *   2. Stock Items for each unique product (under Finished Goods)
 *   3. Sales Account ledgers (Sales, Sales Returns)
 *
 * This must be run ONCE before runImport.js if the company is new.
 *
 * Usage:
 *   node scripts/createMasterData.js
 */

'use strict';

require('dotenv').config();
const axios = require('axios');

const TALLY_URL = `${process.env.TALLY_HOST || 'http://localhost'}:${process.env.TALLY_PORT || 9000}`;
const CO_NAME   = process.env.TALLY_COMPANY_NAME || 'Wallnut';

const { salesData, inventorySummary } = require('../data');

const sep = (t) => console.log(`\n${'═'.repeat(65)}\n  ${t}\n${'═'.repeat(65)}`);

async function post(xml) {
  const res = await axios.post(TALLY_URL, xml, {
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: 15000,
  }).catch(err => {
    if (err.code === 'ECONNREFUSED') {
      console.error(`\n❌ Tally not reachable at ${TALLY_URL}. Start Tally Prime first.`);
      process.exit(1);
    }
    throw err;
  });
  return String(res.data);
}

function parseResult(raw) {
  const created    = (raw.match(/<CREATED>(\d+)<\/CREATED>/)    || [])[1] || '0';
  const altered    = (raw.match(/<ALTERED>(\d+)<\/ALTERED>/)    || [])[1] || '0';
  const errors     = (raw.match(/<ERRORS>(\d+)<\/ERRORS>/)      || [])[1] || '0';
  const exceptions = (raw.match(/<EXCEPTIONS>(\d+)<\/EXCEPTIONS>/) || [])[1] || '0';
  const ignored    = (raw.match(/<IGNORED>(\d+)<\/IGNORED>/)    || [])[1] || '0';
  return { created: +created, altered: +altered, errors: +errors, exceptions: +exceptions, ignored: +ignored };
}

/**
 * Builds a master data import envelope.
 * @param {string[]} messages  TALLYMESSAGE XML strings
 */
function masterEnvelope(messages) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${CO_NAME}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${messages.join('\n')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// ─── 1. Create Sales ledgers ───────────────────────────────────────────────────
async function createSalesLedgers() {
  sep('STEP 1 — Create Sales Account Ledgers');

  const ledgers = [
    { name: 'Sales',         parent: 'Sales Accounts' },
    { name: 'Sales Returns', parent: 'Sales Accounts' },
  ];

  for (const l of ledgers) {
    const msg = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${l.name}" ACTION="CREATE">
        <NAME>${l.name}</NAME>
        <PARENT>${l.parent}</PARENT>
      </LEDGER>
    </TALLYMESSAGE>`;

    const raw = await post(masterEnvelope([msg]));
    const r   = parseResult(raw);
    if (r.created > 0)  console.log(`   ✅ "${l.name}" created`);
    else if (r.altered > 0 || r.ignored > 0) console.log(`   ℹ️  "${l.name}" already exists`);
    else console.log(`   ⚠️  "${l.name}" — C:${r.created} A:${r.altered} E:${r.errors} X:${r.exceptions}`);
  }
}

// ─── 2. Create Party ledgers (Sundry Debtors) ────────────────────────────────
async function createPartyLedgers() {
  sep('STEP 2 — Create Party Ledgers (Sundry Debtors)');

  // Unique party names
  const parties = [...new Set(salesData.map(r => r.partyName))];
  console.log(`   Creating ${parties.length} party ledgers…`);

  let created = 0, existing = 0, failed = 0;
  const BATCH = 20;

  for (let i = 0; i < parties.length; i += BATCH) {
    const slice = parties.slice(i, i + BATCH);
    const messages = slice.map(name => `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${name}" ACTION="CREATE">
          <NAME>${name}</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
        </LEDGER>
      </TALLYMESSAGE>`);

    const raw = await post(masterEnvelope(messages));
    const r   = parseResult(raw);
    created  += r.created;
    existing += r.altered + r.ignored;
    failed   += r.errors + r.exceptions;

    process.stdout.write(`\r   Progress: ${Math.min(i + BATCH, parties.length)}/${parties.length}  `);
  }
  console.log(`\n   ✅ Created: ${created} | Already existed: ${existing} | Failed: ${failed}`);
}

// ─── 3a. Create Units of Measure ───────────────────────────────────────────────
async function createUnits() {
  const units = [...new Set(inventorySummary.map(i => i.unit || 'Nos'))];

  for (const u of units) {
    const msg = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
      <UNIT NAME="${u}" ACTION="CREATE">
        <NAME>${u}</NAME>
        <ORIGINALNAME>${u}</ORIGINALNAME>
        <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
      </UNIT>
    </TALLYMESSAGE>`;

    const raw = await post(masterEnvelope([msg]));
    const r   = parseResult(raw);
    if (r.created > 0) console.log(`   ✅ Unit "${u}" created`);
    else if (r.errors > 0) console.log(`   ℹ️  Unit "${u}" already exists`);
  }
}

// ─── 3. Create Stock Items (no parent required) ─────────────────────────────────
async function createStockItems() {
  sep('STEP 3 — Create Stock Items');

  // First create UOM units
  console.log('   Creating units of measure…');
  await createUnits();

  const items = inventorySummary;
  console.log(`   Creating ${items.length} stock items…`);

  let created = 0, existing = 0, failed = 0;

  for (const item of items) {
    // Try without PARENT first (uses default group), then retry
    const msg = `
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="${item.itemName}" ACTION="CREATE">
          <NAME>${item.itemName}</NAME>
          <BASEUNITS>${item.unit || 'Nos'}</BASEUNITS>
        </STOCKITEM>
      </TALLYMESSAGE>`;

    const raw = await post(masterEnvelope([msg]));
    const r   = parseResult(raw);
    if (r.created > 0)  { created++; }
    else if (r.altered > 0 || r.ignored > 0) { existing++; }
    else { failed++; console.log(`\n   ⚠️  "${item.itemName}" failed — E:${r.errors} X:${r.exceptions}`); }
  }
  console.log(`   ✅ Created: ${created} | Already existed: ${existing} | Failed: ${failed}`);
}

// ─── 4. Create Stock Groups ────────────────────────────────────────────────────
async function createStockGroups() {
  sep('STEP 0 — Create Stock Groups');

  const groups = [...new Set(inventorySummary.map(i => i.stockGroup))];

  for (const g of groups) {
    const msg = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
      <STOCKGROUP NAME="${g}" ACTION="CREATE">
        <NAME>${g}</NAME>
        <PARENT>Primary</PARENT>
        <ISADDABLE>Yes</ISADDABLE>
      </STOCKGROUP>
    </TALLYMESSAGE>`;

    const raw = await post(masterEnvelope([msg]));
    const r   = parseResult(raw);
    if (r.created > 0)  console.log(`   ✅ Group "${g}" created`);
    else                console.log(`   ℹ️  Group "${g}" exists or ignored`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  sep('WALLNUT — CREATE TALLY MASTER DATA');
  console.log(`Target: ${TALLY_URL}  |  Company: "${CO_NAME}"`);

  await createStockGroups();
  await createSalesLedgers();
  await createPartyLedgers();
  await createStockItems();

  sep('ALL MASTER DATA CREATED ✅');
  console.log('\n   Next step: node scripts/runImport.js');
})().catch(err => {
  console.error('\n💥 Fatal:', err.message);
  process.exit(1);
});
