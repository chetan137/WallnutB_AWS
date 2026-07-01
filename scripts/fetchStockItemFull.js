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
      <FETCHLIST>
        <FETCH>NAME</FETCH>
        <FETCH>BASEUNITS</FETCH>
        <FETCH>PARENT</FETCH>
        <FETCH>GSTDETAILS</FETCH>
      </FETCHLIST>
    </DESC>
  </BODY>
</ENVELOPE>`;

axios.post('http://localhost:9000', queryXml, { headers: { 'Content-Type': 'text/xml' } })
  .then(async r => {
    const parsed = await xml2js.parseStringPromise(r.data, { explicitArray: true });
    const coll = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    if (coll && coll.STOCKITEM) {
      console.log('Stock Item Details:');
      coll.STOCKITEM.forEach(i => {
        if (i.$.NAME.includes('Floor Leveler')) {
          console.log(JSON.stringify(i, null, 2));
        }
      });
    } else {
      console.log('No stock items found.');
    }
  })
  .catch(e => console.error(e.message));
