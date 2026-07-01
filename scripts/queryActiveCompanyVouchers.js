const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();
const config = require('../config');

async function main() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVFROMDATE>20260401</SVFROMDATE>
          <SVTODATE>20270331</SVTODATE>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  console.log(`Fetching active company Day Book from Tally...`);
  const res = await axios.post(config.tally.baseUrl, xml, {
    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
    timeout: 60000,
  });

  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true, ignoreAttrs: false, trim: true });

  const body = parsed?.ENVELOPE?.BODY?.[0];
  const importData = body?.IMPORTDATA?.[0];
  const reqData    = importData?.REQUESTDATA?.[0];
  const messages   = reqData?.TALLYMESSAGE || [];

  console.log(`\nTotal TALLYMESSAGE entries: ${messages.length}`);
  
  const dateCounts = {};
  const sampleVouchers = [];
  
  for (const msg of messages) {
    const v = msg?.VOUCHER?.[0];
    if (!v) continue;
    const date = (v.DATE?.[0] || '').trim();
    const vchNo = (v.VOUCHERNUMBER?.[0] || '').trim();
    const narration = (v.NARRATION?.[0] || '').trim();
    
    dateCounts[date] = (dateCounts[date] || 0) + 1;
    
    if (sampleVouchers.length < 15) {
      sampleVouchers.push({ date, vchNo, narration });
    }
  }
  
  console.log('\nDate Counts:', dateCounts);
  console.log('\nSample Vouchers (First 15):');
  console.log(JSON.stringify(sampleVouchers, null, 2));
}

main().catch(console.error);
