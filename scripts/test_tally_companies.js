const axios = require('axios');
const xml2js = require('xml2js');
const cfg = { host: 'http://localhost', port: 9000 };

async function check() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(`${cfg.host}:${cfg.port}`, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' }
    });
    const parsed = await xml2js.parseStringPromise(res.data);
    console.log('COMPANIES:', JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

check();
