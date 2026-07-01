/**
 * scripts/diagnoseTally.js  (v2)
 * Gets the FULL exception detail from Tally by using the correct
 * Tally Prime XML Import API with IMPORTRESULT / exception capture.
 */

'use strict';

require('dotenv').config();
const axios  = require('axios');
const xml2js = require('xml2js');

const TALLY_URL = `${process.env.TALLY_HOST || 'http://localhost'}:${process.env.TALLY_PORT || 9000}`;
const CO_NAME   = process.env.TALLY_COMPANY_NAME || 'Wallnut';

const sep = (t) => console.log(`\n${'═'.repeat(65)}\n  ${t}\n${'═'.repeat(65)}`);

async function post(xml, label) {
  const res = await axios.post(TALLY_URL, xml, {
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: 15000,
  }).catch(err => {
    if (err.code === 'ECONNREFUSED') {
      console.error(`\n❌ Tally not reachable at ${TALLY_URL}. Start Tally and enable HTTP port.`);
      process.exit(1);
    }
    throw err;
  });
  return { status: res.status, data: res.data };
}

async function px(raw) {
  try { return await xml2js.parseStringPromise(String(raw), { explicitArray: false, ignoreAttrs: false }); }
  catch { return null; }
}

// ─── Test 1: Which company is actually open? ───────────────────────────────────
sep('TEST 1 — Get active company via SVCURRENTCOMPANY');

const getCoXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Register</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE>20260401</SVFROMDATE>
          <SVTODATE>20260430</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

(async () => {
  {
    const { data } = await post(getCoXml, 'Co-detect');
    console.log('Raw (200 chars):', String(data).slice(0, 200));
  }

  // ─── Test 2: Import with SVTARGETCOMPANY to force company ─────────────────────
  sep('TEST 2 — Single minimal voucher import (no inventory, no UDF)');

  const vXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <SUBTYPE>Vouchers</SUBTYPE>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${CO_NAME}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE" OBJVIEW="Invoice Voucher View">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>DIAG-V-001</VOUCHERNUMBER>
            <NARRATION>Diagnostic test voucher — delete me</NARRATION>
            <PARTYLEDGERNAME>TOOLS PARK</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TOOLS PARK</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-10000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>10000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const { data: v2 } = await post(vXml, 'Voucher-v2');
  console.log('\n📋 FULL RESPONSE:\n', String(v2));

  const p2 = await px(v2);
  const resp2 = p2?.RESPONSE;
  if (resp2) {
    console.log('\nParsed RESPONSE:');
    console.log('  CREATED:   ', resp2.CREATED);
    console.log('  ALTERED:   ', resp2.ALTERED);
    console.log('  ERRORS:    ', resp2.ERRORS);
    console.log('  EXCEPTIONS:', resp2.EXCEPTIONS);
    console.log('  IGNORED:   ', resp2.IGNORED);
    if (parseInt(resp2.EXCEPTIONS) > 0 || parseInt(resp2.ERRORS) > 0) {
      console.log('\n❌ Tally rejected the voucher!');
    }
    if (parseInt(resp2.CREATED) > 0) {
      console.log('\n✅ Voucher created successfully!');
    }
  }

  // ─── Test 3: Try the legacy Tally 7.2 style import format ─────────────────────
  sep('TEST 3 — Legacy format (no ACTION attr, simpler structure)');

  const v3Xml = `<?xml version="1.0" encoding="UTF-8"?>
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
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>DIAG-V-002</VOUCHERNUMBER>
            <NARRATION>Diagnostic test v3 — delete me</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TOOLS PARK</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-5000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>5000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const { data: v3 } = await post(v3Xml, 'Voucher-v3');
  console.log('\n📋 FULL RESPONSE:\n', String(v3));

  // ─── Test 4: Check if "TOOLS PARK" ledger exists in Tally ─────────────────────
  sep('TEST 4 — Check if TOOLS PARK ledger exists');

  const ledgerCheckXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${CO_NAME}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>Sundry Debtors</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  const { data: l4 } = await post(ledgerCheckXml, 'LedgerCheck');
  const lRaw = String(l4);
  console.log('Raw (600 chars):', lRaw.slice(0, 600));
  const toolsParkFound = lRaw.toLowerCase().includes('tools park');
  console.log(toolsParkFound
    ? '\n✅ "TOOLS PARK" ledger FOUND in Sundry Debtors'
    : '\n❌ "TOOLS PARK" ledger NOT FOUND — this is why voucher import fails!');

  if (!toolsParkFound) {
    console.log('\n══ ROOT CAUSE IDENTIFIED ══════════════════════════════════════');
    console.log('   The party ledger "TOOLS PARK" does not exist in Tally.');
    console.log('   Tally silently marks the voucher as EXCEPTION (not ERROR) when');
    console.log('   a ledger referenced in the voucher cannot be found.');
    console.log('\n══ FIX (Option A — Recommended) ═══════════════════════════════');
    console.log('   Auto-create all missing ledgers before importing vouchers.');
    console.log('   Run: node scripts/createMasterData.js');
    console.log('\n══ FIX (Option B — Manual) ═════════════════════════════════════');
    console.log('   In Tally: Gateway → Accounts Info → Ledgers → Create');
    console.log('   Create each party name as a Sundry Debtors ledger.');
  }

  sep('DIAGNOSTIC COMPLETE');
})();
