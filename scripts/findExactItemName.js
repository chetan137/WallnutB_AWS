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
    const coll = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    if (coll && coll.STOCKITEM) {
      coll.STOCKITEM.forEach(i => {
        const name = i.$.NAME;
        if (name.includes('Floor Leveler')) {
          console.log('Name:', JSON.stringify(name));
          console.log('Length:', name.length);
          const chars = [];
          for (let c = 0; c < name.length; c++) {
            chars.push(name.charCodeAt(c));
          }
          console.log('Char codes:', chars);
        }
      });
    }
  })
  .catch(e => console.error(e.message));
