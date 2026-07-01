const axios = require('axios');
const xml2js = require('xml2js');

const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockItem</ID>
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
    const parsed = await xml2js.parseStringPromise(r.data, { explicitArray: true });
    console.log('Parsed ENVELOPE structure keys:', Object.keys(parsed?.ENVELOPE || {}));
    console.log('Parsed BODY structure keys:', Object.keys(parsed?.ENVELOPE?.BODY?.[0] || {}));
    console.log('Parsed DATA structure keys:', Object.keys(parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0] || {}));
    const coll = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    console.log('Parsed COLLECTION structure keys:', Object.keys(coll || {}));
    if (coll && coll.STOCKITEM) {
      console.log('Found stock items:', coll.STOCKITEM.length);
      coll.STOCKITEM.forEach(i => console.log('  -', i.$.NAME));
    }
  })
  .catch(e => console.error(e.message));
