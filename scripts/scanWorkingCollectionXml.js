const axios = require('axios');
require('dotenv').config();
const config = require('../config');

async function main() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllVouchersCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${config.tally.companyName}</SVCURRENTCOMPANY>
        <SVFROMDATE>20260401</SVFROMDATE>
        <SVTODATE>20270331</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllVouchersCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes">
            <TYPE>Voucher</TYPE>
            <FETCH>VoucherNumber, Date, VoucherTypeName, PartyLedgerName, Narration</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  console.log(`Fetching 34MB collection from Tally...`);
  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000,
    });
    
    const data = res.data;
    console.log(`Raw XML response length in characters: ${data.length}`);
    
    // Check if there are voucher tags
    const voucherMatches = data.match(/<VOUCHER/gi) || [];
    console.log(`Number of '<VOUCHER' tags found in raw XML: ${voucherMatches.length}`);
    
    // Find all distinct dates in the raw XML using regex
    const datesFound = {};
    const dateRegex = /<DATE(?:\s+[^>]*)?>\s*(\d{8})\s*<\/DATE>/gi;
    let match;
    let dateCount = 0;
    while ((match = dateRegex.exec(data)) !== null) {
      const d = match[1];
      datesFound[d] = (datesFound[d] || 0) + 1;
      dateCount++;
    }
    
    console.log(`Total DATE tags found: ${dateCount}`);
    console.log('\nDates found via regex:', datesFound);
    
    // Check for some pushed-style voucher numbers
    const vchNoRegex = /<VOUCHERNUMBER(?:\s+[^>]*)?>\s*([^<]+)\s*<\/VOUCHERNUMBER>/gi;
    const vchNos = [];
    let limit = 0;
    while ((match = vchNoRegex.exec(data)) !== null) {
      const vNo = match[1].trim();
      if (vNo.includes('WBKER') || vNo.includes('WBMAH') || vNo.includes('DEMO')) {
        vchNos.push(vNo);
      }
    }
    console.log(`\nPushed-style voucher numbers count: ${vchNos.length}`);
    if (vchNos.length > 0) {
      console.log('Sample pushed voucher numbers:', vchNos.slice(0, 10));
    }
    
    // Let's print the first 1000 characters of the <BODY> element to see the structure
    const bodyIdx = data.indexOf('<BODY>');
    if (bodyIdx !== -1) {
      console.log('\n--- BODY structure start ---');
      console.log(data.substring(bodyIdx, bodyIdx + 1500));
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
