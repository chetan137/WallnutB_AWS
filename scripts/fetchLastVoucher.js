const axios = require('axios');
const xml2js = require('xml2js');

const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Vouchers</ID>
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
    console.log('Vouchers response length:', r.data.length);
    const parsed = await xml2js.parseStringPromise(r.data, { explicitArray: true });
    const collection = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    if (collection && collection.VOUCHER) {
      console.log(`Found ${collection.VOUCHER.length} vouchers in Tally.`);
      // Print the last voucher XML structure
      console.log('--- Last Voucher Raw XML ---');
      console.log(r.data.substring(r.data.lastIndexOf('<VOUCHER '), r.data.lastIndexOf('</VOUCHER>') + 10));
    } else {
      console.log('No vouchers found in Tally.');
      console.log(r.data.substring(0, 1000));
    }
  })
  .catch(e => console.error(e.message));
