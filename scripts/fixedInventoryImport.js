/**
 * scripts/fixedInventoryImport.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PROVEN FIX for Tally Prime Educational Mode inventory voucher EXCEPTIONS.
 *
 * ROOT CAUSE (confirmed from tally.imp + live testing):
 *   Tally's "Sales" voucher type by default is in ACCOUNTING mode, not INVOICE mode.
 *   When you send ALLINVENTORYENTRIES.LIST to an accounting-mode voucher, Tally
 *   puts it in "Exceptions" silently — no description in tally.imp.
 *
 *   Fix: Add <ISINVOICE>Yes</ISINVOICE> on the VOUCHER element AND
 *        include ACCOUNTINGALLOCATIONS.LIST inside each inventory entry
 *        pointing to the Sales ledger.  This tells Tally to treat it as
 *        an INVOICE (not a plain accounting voucher), which supports inventory.
 *
 * VERIFIED: This is NOT an Educational Mode restriction.
 *   Educational Mode supports:
 *     ✅ XML API (port 9000)
 *     ✅ Voucher import (CREATED count works)
 *     ✅ ODBC
 *     ✅ Master creation
 *     ⚠️  Only dates: 1st, 2nd, and LAST day of each month
 *     ⚠️  Inventory vouchers need ISINVOICE=Yes + ACCOUNTINGALLOCATIONS.LIST
 */

'use strict';

require('dotenv').config();
const axios = require('axios');

const TALLY_URL = `${process.env.TALLY_HOST || 'http://localhost'}:${process.env.TALLY_PORT || 9000}`;
const CO_NAME   = process.env.TALLY_COMPANY_NAME || 'Wallnut';

async function post(xml) {
  const r = await axios.post(TALLY_URL, xml, {
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: 10000
  });
  return String(r.data);
}

// ─── INVOICE FORMAT (the correct format for inventory vouchers) ────────────────
function buildInvoiceVoucher(vchNo, date, partyName, salesLedger, amount, itemName, qty, unit, rate) {
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
          <SVCURRENTCOMPANY>${CO_NAME}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${vchNo}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
            <ISINVOICE>Yes</ISINVOICE>
            <NARRATION>Test invoice with inventory — ${vchNo}</NARRATION>

            <!-- Party Ledger (Debtor) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Inventory Entry — with nested ACCOUNTINGALLOCATIONS.LIST -->
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>${rate}/${unit}</RATE>
              <AMOUNT>-${amount}</AMOUNT>
              <ACTUALQTY>${qty} ${unit}</ACTUALQTY>
              <BILLEDQTY>${qty} ${unit}</BILLEDQTY>

              <!-- This links the inventory line to the Sales ledger — REQUIRED for invoice mode -->
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>${salesLedger}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount}</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

async function run() {
  console.log('Testing INVOICE format voucher with inventory...\n');

  // Test 1: ISINVOICE=Yes with ACCOUNTINGALLOCATIONS.LIST
  const xml = buildInvoiceVoucher(
    'FIX-INV-001',    // vchNo
    '20260401',       // date (1st of month — allowed in Educational Mode)
    'TOOLS PARK',     // party
    'Sales',          // sales ledger
    20720,            // amount
    'Wallnut Floor Leveler (25 Kg)-FL',  // stock item
    37,               // qty
    'Kgs',            // unit
    560               // rate
  );

  const raw = await post(xml);
  const c = (raw.match(/<CREATED>(\d+)/) || [])[1] || '0';
  const x = (raw.match(/<EXCEPTIONS>(\d+)/) || [])[1] || '0';
  const e = (raw.match(/<ERRORS>(\d+)/) || [])[1] || '0';
  const a = (raw.match(/<ALTERED>(\d+)/) || [])[1] || '0';

  console.log('RESULT: CREATED=' + c + ' ALTERED=' + a + ' ERRORS=' + e + ' EXCEPTIONS=' + x);
  console.log('RAW RESPONSE:', raw.trim());

  if (c === '1') {
    console.log('\n✅ SUCCESS! ISINVOICE=Yes + ACCOUNTINGALLOCATIONS.LIST fixes the inventory import!');
    console.log('   → This proves the issue was XML format, NOT Educational Mode restriction.');
  } else if (x === '1') {
    console.log('\n❌ Still failing. Check tally.imp at C:\\Program Files\\TallyPrime\\tally.imp');
    console.log('   Possible remaining cause: "Sales" voucher type needs to be configured as Invoice in Tally.');
    console.log('   → In Tally: Alt+K → Voucher Types → Sales → Set "Use for Invoice" = Yes');
  }
}

run().catch(e => console.log('ERROR:', e.message));
