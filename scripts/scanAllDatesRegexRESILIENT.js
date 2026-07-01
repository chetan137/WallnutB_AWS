const axios = require('axios');
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
          <SVCURRENTCOMPANY>${config.tally.companyName}</SVCURRENTCOMPANY>
          <SVFROMDATE>20250401</SVFROMDATE>
          <SVTODATE>20270331</SVTODATE>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 60000,
    });
    
    const data = res.data;
    
    // Find all <DATE...> tags
    const datesFound = {};
    const dateRegex = /<DATE(?:\s+[^>]*)?>\s*(\d{8})\s*<\/DATE>/gi;
    let match;
    let count = 0;
    while ((match = dateRegex.exec(data)) !== null) {
      const d = match[1];
      datesFound[d] = (datesFound[d] || 0) + 1;
      count++;
    }
    
    console.log(`Total DATE tags found: ${count}`);
    console.log('Date Counts:', datesFound);

    // Let's also search for VOUCHER NUMBER tags to count them
    const vchNoFound = {};
    const vchNoRegex = /<VOUCHERNUMBER(?:\s+[^>]*)?>\s*([^<]+)\s*<\/VOUCHERNUMBER>/gi;
    let vchCount = 0;
    while ((match = vchNoRegex.exec(data)) !== null) {
      const vNo = match[1].trim();
      vchNoFound[vNo] = (vchNoFound[vNo] || 0) + 1;
      vchCount++;
    }
    console.log(`Total VOUCHERNUMBER tags found: ${vchCount}`);
    
    // Check if any of our pushed voucher numbers (like WBKER-001/25-26) are in the keys
    const pushedKeys = Object.keys(vchNoFound).filter(k => k.includes('WBKER') || k.includes('WBMAH') || k.includes('DEMO'));
    console.log(`Pushed-style voucher numbers found in response: ${pushedKeys.length}`);
    if (pushedKeys.length > 0) {
      console.log('Sample found:', pushedKeys.slice(0, 10));
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
