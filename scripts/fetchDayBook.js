const axios = require('axios');

const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Day Book</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>Wallnut</SVCURRENTCOMPANY>
        <SVFROMDATE>20250401</SVFROMDATE>
        <SVTODATE>20250630</SVTODATE>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

axios.post('http://localhost:9000', queryXml, { headers: { 'Content-Type': 'text/xml' } })
  .then(r => {
    console.log('Raw response length:', r.data.length);
    console.log('Raw response (first 2000 chars):');
    console.log(r.data.substring(0, 2000));
  })
  .catch(e => {
    console.error('Error fetching Day Book:', e.message);
  });
