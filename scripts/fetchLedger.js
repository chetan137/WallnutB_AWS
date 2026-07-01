const axios = require('axios');

const queryLedger = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Ledger</ID>
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

const queryStockItem = `<?xml version="1.0" encoding="UTF-8"?>
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

async function check() {
  try {
    const resLedger = await axios.post('http://localhost:9000', queryLedger, { headers: { 'Content-Type': 'text/xml' } });
    console.log('Has Ledger "Sales":', resLedger.data.includes('<NAME>Sales</NAME>'));
    console.log('Has Ledger "Sales Returns":', resLedger.data.includes('<NAME>Sales Returns</NAME>'));

    const resStock = await axios.post('http://localhost:9000', queryStockItem, { headers: { 'Content-Type': 'text/xml' } });
    console.log('Stock items response length:', resStock.data.length);
    console.log('Has Stock Item "Wallnut Floor Leveler (25 Kg)-FL":', resStock.data.includes('Wallnut Floor Leveler (25 Kg)-FL'));
  } catch (err) {
    console.error(err.message);
  }
}

check();
