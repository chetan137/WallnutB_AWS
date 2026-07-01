const axios = require('axios');
const xml2js = require('xml2js');
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
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>Company</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 10000,
    });
    console.log('Raw XML Response:', res.data);
    const parsed = await xml2js.parseStringPromise(res.data);
    console.log('Parsed:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
