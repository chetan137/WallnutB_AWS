const axios = require('axios');

const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Object</TYPE>
    <SUBTYPE>StockItem</SUBTYPE>
    <ID>Wallnut Floor Leveler (25 Kg)-FL</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>Wallnut</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

axios.post('http://localhost:9000', queryXml, { headers: { 'Content-Type': 'text/xml' } })
  .then(r => {
    console.log('Stock Item Detail Response length:', r.data.length);
    console.log('Response:');
    console.log(r.data);
  })
  .catch(e => console.error(e.message));
