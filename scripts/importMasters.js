/**
 * scripts/importMasters.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates and imports Tally Masters (Units, Stock Groups, Stock Items, Ledgers)
 * into Tally Prime so that Vouchers can be successfully imported without
 * "Ledger/Item does not exist" exceptions.
 */

'use strict';

const axios  = require('axios');
const xml2js = require('xml2js');
const config = require('../config');
const logger = require('../utils/logger');
const { allDealers } = require('../data');

// ─── Master Data definitions ──────────────────────────────────────────────────

const units = ['Kgs', 'Nos'];
const stockGroups = ['Finished Goods'];

const products = [
  { name: 'Calcibond Secure White (20 Kg)-N', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Calcibond Secure Grey (20 Kg)-N', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Tile Adhesive (20 Kg)', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Wall Putty (40 Kg)-P', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Waterproof Coat (20 L)-W', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut Block Jointing Mortar (40 Kg)', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Epoxy Grout (1 Kg)-E', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut Crack Fill Paste (1 Kg)', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut SBR Latex (5 L)-S', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut Primer Coat (20 L)-PC', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut GP Adhesive (50 Kg)-GP', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Heavy Duty Adhesive (20 Kg)-HD', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Waterproof Cement (50 Kg)', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Anti-Corrosion Coat (4 L)-AC', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut Floor Leveler (25 Kg)-FL', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Bonding Agent (5 L)-BA', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut Grout (2 Kg) White-GW', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut Stone Adhesive (25 Kg)-SA', group: 'Finished Goods', unit: 'Kgs' },
  { name: 'Wallnut Roof Seal (10 L)-RS', group: 'Finished Goods', unit: 'Nos' },
  { name: 'Wallnut Plaster Bond (20 L)-PB', group: 'Finished Goods', unit: 'Nos' },
];

const generalLedgers = [
  { name: 'Sales', parent: 'Sales Accounts' },
  { name: 'Sales Returns', parent: 'Sales Accounts' },
];

// ─── XML Generation Helpers ───────────────────────────────────────────────────

function escapeXml(val) {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(config.tally.companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${messages.join('\n')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// ─── Import Logic ─────────────────────────────────────────────────────────────

async function importMasters() {
  logger.info('═══════════════════════════════════════════════════');
  logger.info('  Importing Wallnut Masters to Tally Prime');
  logger.info('═══════════════════════════════════════════════════');

  const messages = [];

  // 1. Units of Measure
  units.forEach((u) => {
    messages.push(`
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <UNIT NAME="${escapeXml(u)}" ACTION="CREATE">
          <SYMBOL>${escapeXml(u)}</SYMBOL>
          <NAME>${escapeXml(u)}</NAME>
          <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
        </UNIT>
      </TALLYMESSAGE>`);
  });

  // 2. Stock Groups
  stockGroups.forEach((g) => {
    messages.push(`
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKGROUP NAME="${escapeXml(g)}" ACTION="CREATE">
          <NAME>${escapeXml(g)}</NAME>
        </STOCKGROUP>
      </TALLYMESSAGE>`);
  });

  // 3. Stock Items (Products)
  products.forEach((p) => {
    messages.push(`
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="${escapeXml(p.name)}" ACTION="CREATE">
          <NAME>${escapeXml(p.name)}</NAME>
          <PARENT>${escapeXml(p.group)}</PARENT>
          <UOMNAME>${escapeXml(p.unit)}</UOMNAME>
        </STOCKITEM>
      </TALLYMESSAGE>`);
  });

  // 4. General Ledgers (Sales / Sales Returns)
  generalLedgers.forEach((l) => {
    messages.push(`
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${escapeXml(l.name)}" ACTION="CREATE">
          <NAME>${escapeXml(l.name)}</NAME>
          <PARENT>${escapeXml(l.parent)}</PARENT>
        </LEDGER>
      </TALLYMESSAGE>`);
  });

  // 5. Dealers (Sundry Debtors)
  allDealers.forEach((d) => {
    messages.push(`
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${escapeXml(d.name)}" ACTION="CREATE">
          <NAME>${escapeXml(d.name)}</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <MAILINGNAME>${escapeXml(d.name)}</MAILINGNAME>
          <COUNTRY>India</COUNTRY>
          <STATENAME>${escapeXml(d.state)}</STATENAME>
        </LEDGER>
      </TALLYMESSAGE>`);
  });

  logger.info(`Compiled ${messages.length} master entities. Sending to Tally in batches of 30…`);

  const MASTER_BATCH_SIZE = 30;
  let batchCount = 0;

  for (let i = 0; i < messages.length; i += MASTER_BATCH_SIZE) {
    const batch = messages.slice(i, i + MASTER_BATCH_SIZE);
    batchCount++;
    logger.info(`Sending master batch ${batchCount} (${batch.length} entities)…`);

    try {
      const envelope = buildEnvelope(batch);
      const response = await axios.post(config.tally.baseUrl, envelope, {
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        timeout: 30_000,
      });

      const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
      const body = parsed?.ENVELOPE?.BODY?.DATA;

      if (body?.RESPONSE) {
        logger.success(`Batch ${batchCount}: ${body.RESPONSE}`);
      }
      if (body?.LINEERROR) {
        const errs = Array.isArray(body.LINEERROR) ? body.LINEERROR : [body.LINEERROR];
        logger.warn(`Batch ${batchCount}: ${errs.length} errors/warnings (some masters may already exist):`);
        errs.slice(0, 5).forEach((e) => console.log('    -', e));
        if (errs.length > 5) console.log(`    ... and ${errs.length - 5} more`);
      }
    } catch (err) {
      logger.error(`Batch ${batchCount} failed:`, err.message);
      // We continue with other batches since some masters might succeed
    }
  }

  logger.success('✔ All master import batches processed. Let us re-run the vouchers import now!');
}

if (require.main === module) {
  importMasters();
}

module.exports = importMasters;
