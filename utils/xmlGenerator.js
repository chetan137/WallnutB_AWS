/**
 * utils/xmlGenerator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts Wallnut transaction objects into Tally-compatible XML envelopes.
 *
 * ⚠️  IMPORTANT — Tally Prime XML format notes (verified by live testing):
 *
 *  • <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>   ← correct
 *  • <HEADER><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE>…  ← "Unknown Request"
 *  • Do NOT use OBJVIEW="Invoice Voucher View" on <VOUCHER> — causes EXCEPTIONS
 *  • Add <ISPARTYLEDGER>Yes</ISPARTYLEDGER> on the party ledger entry
 *  • Add <PARTYLEDGERNAME> at the voucher level (used by Tally for display)
 *  • Date format: YYYYMMDD  (no dashes)
 *  • Amount: positive number as text — Tally interprets sign from Dr/Cr context
 *    - Debit  (party, Dr) → ISDEEMEDPOSITIVE=Yes, AMOUNT is negative  e.g. -10000
 *    - Credit (sales, Cr) → ISDEEMEDPOSITIVE=No,  AMOUNT is positive  e.g.  10000
 *  • Inventory AMOUNT sign:
 *    - Sales entry  → AMOUNT = negative (goods going out)  -5000
 *    - Credit Note  → AMOUNT = positive (goods coming back) 5000
 *
 *  Response XML shape from Tally Prime (confirmed):
 *  <RESPONSE>
 *    <CREATED>1</CREATED>  <ALTERED>0</ALTERED>  <ERRORS>0</ERRORS>
 *    <EXCEPTIONS>0</EXCEPTIONS>  <IGNORED>0</IGNORED>
 *  </RESPONSE>
 */

'use strict';

const config = require('../config');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** YYYY-MM-DD → YYYYMMDD */
function toTallyDate(dateStr) {
  return String(dateStr).replace(/-/g, '');
}

/** Detect voucher type */
function parseTallyVoucherType(vchType) {
  const isCreditNote = /credit note/i.test(vchType);
  return {
    tallyVchType: isCreditNote ? 'Credit Note' : 'Sales',
    isCreditNote,
  };
}

// ─── Single Voucher XML ────────────────────────────────────────────────────────

/**
 * Generates a single TALLYMESSAGE XML block.
 *
 * Verified working format:
 *  - No OBJVIEW attribute on VOUCHER (causes EXCEPTIONS in Tally Prime)
 *  - ISPARTYLEDGER=Yes on the party ledger entry
 *  - PARTYLEDGERNAME at voucher level
 *  - Correct AMOUNT sign convention
 *
 * @param {Object}          txn     Single record from salesData
 * @param {'CREATE'|'ALTER'} action  CREATE for new, ALTER for update
 * @returns {string}  XML TALLYMESSAGE block
 */
function buildVoucherXml(txn, action = 'CREATE') {
  const { tallyVchType, isCreditNote } = parseTallyVoucherType(txn.vchType);
  const tallyDate  = toTallyDate(txn.date);
  const amt        = Math.abs(txn.amount);
  const qty        = Math.abs(txn.quantity);
  const salesLedger = isCreditNote ? 'Sales Returns' : 'Sales';

  // Amount sign rules:
  //   Party (Debtor)  → always debit → AMOUNT negative  (-amt)
  //   Sales ledger    → always credit → AMOUNT positive  (+amt)
  //   Inventory:
  //     Sales  → going out  → AMOUNT negative (-amt)
  //     Credit → coming in  → AMOUNT positive (+amt)
  const partyAmount = isCreditNote ? amt : -amt;   // Credit note: party gets money back (credit side)
  const salesAmount = isCreditNote ? -amt : amt;   // Credit note: sales returns reduces revenue

  // Tally ISDEEMEDPOSITIVE = whether the entry is a "receipt" from Tally's perspective
  //   Debit  (money owed to us) → Yes
  //   Credit (revenue/income)   → No
  const partyDeemed = 'Yes';   // party is always debit in sales
  const salesDeemed = 'No';    // sales/income is always credit

  const invAmount = isCreditNote ? amt : -amt;
  const invDeemed = isCreditNote ? 'Yes' : 'No';

  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${escapeXml(tallyVchType)}" ACTION="${action}">
        <DATE>${tallyDate}</DATE>
        <VOUCHERTYPENAME>${escapeXml(tallyVchType)}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${escapeXml(txn.vchNo)}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${escapeXml(txn.partyName)}</PARTYLEDGERNAME>
        <NARRATION>Item: ${escapeXml(txn.itemName)} | Qty: ${qty} ${escapeXml(txn.units)} | Rate: ${txn.rate} | Area: ${escapeXml(txn.areaCity)} | SO: ${escapeXml(txn.salesMan)} | State: ${escapeXml(txn.state)}</NARRATION>

        <!-- Party ledger (Debtor) -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(txn.partyName)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${partyDeemed}</ISDEEMEDPOSITIVE>
          <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
          <AMOUNT>${partyAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>

        <!-- Sales / Sales Returns ledger -->
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(salesLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${salesDeemed}</ISDEEMEDPOSITIVE>
          <AMOUNT>${salesAmount}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>

        <!-- Inventory entry -->
        <ALLINVENTORYENTRIES.LIST>
          <STOCKITEMNAME>${escapeXml(txn.itemName)}</STOCKITEMNAME>
          <ISDEEMEDPOSITIVE>${invDeemed}</ISDEEMEDPOSITIVE>
          <RATE>${txn.rate}/${escapeXml(txn.units)}</RATE>
          <AMOUNT>${invAmount}</AMOUNT>
          <ACTUALQTY>${qty} ${escapeXml(txn.units)}</ACTUALQTY>
          <BILLEDQTY>${qty} ${escapeXml(txn.units)}</BILLEDQTY>
        </ALLINVENTORYENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>`;
}

// ─── Full Import Envelope ──────────────────────────────────────────────────────

/**
 * Wraps TALLYMESSAGE blocks in a valid Tally import envelope.
 * Uses "Import Data" TALLYREQUEST (verified working with Tally Prime).
 *
 * @param {string[]} messages
 * @returns {string}
 */
function buildImportEnvelope(messages) {
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

// ─── Fetch / Query Envelopes ───────────────────────────────────────────────────

function buildSalesRegisterRequest(dateRange = {}) {
  const from = dateRange.from ? toTallyDate(dateRange.from) : '20260401';
  const today = new Date();
  const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const to   = dateRange.to   ? toTallyDate(dateRange.to)   : todayStr;

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(config.tally.companyName)}</SVCURRENTCOMPANY>
          <SVFROMDATE>${from}</SVFROMDATE>
          <SVTODATE>${to}</SVTODATE>
          <VOUCHERTYPE>Sales</VOUCHERTYPE>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function buildOutstandingRequest() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Outstanding Receivables</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(config.tally.companyName)}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function buildLedgerMasterRequest() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(config.tally.companyName)}</SVCURRENTCOMPANY>
          <ACCOUNTTYPE>Sundry Debtors</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function buildInventoryRequest() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Stock Summary</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(config.tally.companyName)}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

module.exports = {
  buildVoucherXml,
  buildImportEnvelope,
  buildSalesRegisterRequest,
  buildOutstandingRequest,
  buildLedgerMasterRequest,
  buildInventoryRequest,
  escapeXml,
  toTallyDate,
};
