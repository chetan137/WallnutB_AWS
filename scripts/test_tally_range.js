const axios = require('axios');
const xml2js = require('xml2js');
const cfg = { host: 'http://localhost', port: 9000, companyName: 'Wallnut3' };

async function check() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${cfg.companyName}</SVCURRENTCOMPANY>
          <SVFROMDATE>20260401</SVFROMDATE>
          <SVTODATE>20270331</SVTODATE>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(`${cfg.host}:${cfg.port}`, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' }
    });
    const parsed = await xml2js.parseStringPromise(res.data);
    const messages = parsed?.ENVELOPE?.BODY?.[0]?.IMPORTDATA?.[0]?.REQUESTDATA?.[0]?.TALLYMESSAGE || [];
    console.log('SUCCESS: found', messages.length, 'vouchers');
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

check();
