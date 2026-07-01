const axios = require('axios');
const xml2js = require('xml2js');

const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockItems</ID>
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
  .then(async r => {
    const parsed = await xml2js.parseStringPromise(r.data);
    console.log('Stock Items Response:');
    const items = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM;
    if (items) {
      const list = Array.isArray(items) ? items : [items];
      console.log(`Found ${list.length} Stock Items in Tally:`);
      list.slice(0, 10).forEach(item => {
        console.log(`  - Name: ${item.NAME || item.$.NAME}`);
      });
    } else {
      console.log('No stock items found in Tally.');
    }
  })
  .catch(e => {
    console.error('Error fetching stock items:', e.message);
  });
