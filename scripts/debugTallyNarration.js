/**
 * Debug script: fetch raw Day Book from Tally and show first few narrations
 * Run: node scripts/debugTallyNarration.js
 */
'use strict';
const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();
const config = require('../config');

async function main() {
  const today = new Date();
  const toDate = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${config.tally.companyName}</SVCURRENTCOMPANY>
          <SVFROMDATE>20260401</SVFROMDATE>
          <SVTODATE>${toDate}</SVTODATE>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  console.log(`Fetching Day Book from Tally (${config.tally.companyName})...`);
  const res = await axios.post(config.tally.baseUrl, xml, {
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: 30000,
  });

  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true, ignoreAttrs: false, trim: true });

  // Try both paths
  const body = parsed?.ENVELOPE?.BODY?.[0];
  const importData = body?.IMPORTDATA?.[0];
  const reqData    = importData?.REQUESTDATA?.[0];
  const messages   = reqData?.TALLYMESSAGE || [];

  console.log(`\nTotal TALLYMESSAGE entries: ${messages.length}`);
  const dateCounts = {};
  const vchTypes = {};
  const partyNames = new Set();
  
  for (const msg of messages) {
    const v = msg?.VOUCHER?.[0];
    if (!v) continue;
    const date = (v.DATE?.[0] || '').trim();
    const vchType = (v.VOUCHERTYPENAME?.[0] || '').trim();
    const partyName = (v.PARTYLEDGERNAME?.[0] || '').trim();
    
    dateCounts[date] = (dateCounts[date] || 0) + 1;
    vchTypes[vchType] = (vchTypes[vchType] || 0) + 1;
    partyNames.add(partyName);
  }
  
  console.log('\nDate Counts:', dateCounts);
  console.log('\nVoucher Type Counts:', vchTypes);
  console.log('\nUnique Parties count:', partyNames.size);
  
  console.log('\nFirst 5 voucher narrations:\n');
  let shown = 0;
  for (const msg of messages) {
    if (shown >= 5) break;
    const v = msg?.VOUCHER?.[0];
    if (!v) continue;
    const vchType   = (v.VOUCHERTYPENAME?.[0] || '').trim();
    const narration = (v.NARRATION?.[0] || '').trim();
    const partyName = (v.PARTYLEDGERNAME?.[0] || '').trim();
    const date      = (v.DATE?.[0] || '').trim();
    if (!/^(Sales|Credit Note)$/i.test(vchType)) continue;
    console.log(`  VchType: ${vchType}`);
    console.log(`  Party:   ${partyName}`);
    console.log(`  Date:    ${date}`);
    console.log(`  Narration: "${narration}"`);
    console.log(`  Has Item: tag: ${/Item:/i.test(narration)}`);
    console.log('');
    shown++;
  }

  if (shown === 0) {
    console.log('No Sales vouchers found in Day Book response.');
    console.log('Raw XML keys at BODY level:', Object.keys(body || {}));
  }
}

main().catch(console.error);
