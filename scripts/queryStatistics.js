const axios = require('axios');
require('dotenv').config();
const config = require('../config');

async function main() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Statistics</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${config.tally.companyName}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  console.log(`Querying Statistics from Tally for company ${config.tally.companyName}...`);
  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 20000,
    });
    console.log('Raw XML Response:', res.data);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
