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

  console.log(`Fetching raw Day Book from Tally (${config.tally.companyName})...`);
  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 60000,
    });
    
    const data = res.data;
    console.log(`Raw XML response length in characters: ${data.length}`);
    
    // Check if there are voucher tags
    const voucherMatches = data.match(/<VOUCHER/g) || [];
    console.log(`Number of '<VOUCHER' tags found in raw XML: ${voucherMatches.length}`);
    
    // Find all distinct dates in the raw XML using regex
    const datesFound = {};
    const dateRegex = /<DATE>(\d{8})<\/DATE>/g;
    let match;
    while ((match = dateRegex.exec(data)) !== null) {
      const d = match[1];
      datesFound[d] = (datesFound[d] || 0) + 1;
    }
    
    console.log('\nDates found via regex:', datesFound);
    
    // Find some voucher numbers using regex
    const vchNoFound = [];
    const vchNoRegex = /<VOUCHERNUMBER>([^<]+)<\/VOUCHERNUMBER>/g;
    let limit = 0;
    while ((match = vchNoRegex.exec(data)) !== null && limit < 10) {
      vchNoFound.push(match[1]);
      limit++;
    }
    console.log('\nFirst 10 voucher numbers found via regex:', vchNoFound);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
