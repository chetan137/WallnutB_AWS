const axios = require('axios');

async function run() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Voucher</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>Wallnut2</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <FETCHLIST>
        <FETCH>DATE</FETCH>
        <FETCH>VOUCHERNUMBER</FETCH>
        <FETCH>PARTYLEDGERNAME</FETCH>
        <FETCH>VOUCHERTYPENAME</FETCH>
        <FETCH>NARRATION</FETCH>
        <FETCH>ALLINVENTORYENTRIES</FETCH>
      </FETCHLIST>
    </DESC>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post('http://localhost:9000', xml, { headers: { 'Content-Type': 'text/xml' }, timeout: 10000 });
    console.log('=== VOUCHER COLLECTION RESPONSE ===');
    console.log(res.data.substring(0, 3000));
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

run();
