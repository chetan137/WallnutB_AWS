const axios = require('axios');
const xml2js = require('xml2js');

const alterXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Wallnut</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Wallnut Floor Leveler (25 Kg)-FL" ACTION="ALTER">
            <NAME>Wallnut Floor Leveler (25 Kg)-FL</NAME>
            <PARENT>Finished Goods</PARENT>
            <BASEUNITS>Kgs</BASEUNITS>
            <BASEUNIT>Kgs</BASEUNIT>
            <UNITS>Kgs</UNITS>
            <UOM>Kgs</UOM>
            <UOMNAME>Kgs</UOMNAME>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

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
        <FETCH>BASEUNIT</FETCH>
        <FETCH>UNITS</FETCH>
        <FETCH>UOM</FETCH>
        <FETCH>UOMNAME</FETCH>
        <FETCH>PARENT</FETCH>
      </FETCHLIST>
    </DESC>
  </BODY>
</ENVELOPE>`;

async function run() {
  try {
    console.log('Sending multi-tag alter request to Tally...');
    const res1 = await axios.post('http://localhost:9000', alterXml, { headers: { 'Content-Type': 'text/xml' } });
    console.log('Alter Response raw:', res1.data);

    console.log('Fetching stock item to see which tag contains UOM...');
    const res2 = await axios.post('http://localhost:9000', queryXml, { headers: { 'Content-Type': 'text/xml' } });
    const parsed = await xml2js.parseStringPromise(res2.data, { explicitArray: true });
    const coll = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    if (coll && coll.STOCKITEM) {
      coll.STOCKITEM.forEach(i => {
        if (i.$.NAME.includes('Floor Leveler')) {
          console.log('Stock Item Fields in Tally:');
          console.log(JSON.stringify(i, null, 2));
        }
      });
    } else {
      console.log('No stock items found.');
    }
  } catch (err) {
    console.error(err.message);
  }
}

run();
