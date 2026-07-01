const axios = require('axios');
const xml2js = require('xml2js');

const alterStockXml = `<?xml version="1.0" encoding="UTF-8"?>
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
            <UNITS>Kgs</UNITS>
            <BASEUNITS>Kgs</BASEUNITS>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

const testVoucherXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Wallnut</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE" OBJVIEW="Invoice Voucher View">
            <DATE>20260601</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-NEST-STOCK-ALTER-OK</VOUCHERNUMBER>
            <PARTYLEDGERNAME>TOOLS PARK</PARTYLEDGERNAME>
            
            <!-- Party Ledger entry -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TOOLS PARK</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-20862</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Inventory entry with nested Accounting Allocations -->
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>Wallnut Floor Leveler (25 Kg)-FL</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>549/Kgs</RATE>
              <AMOUNT>20862</AMOUNT>
              <ACTUALQTY>38 Kgs</ACTUALQTY>
              <BILLEDQTY>38 Kgs</BILLEDQTY>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Sales</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>20862</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

async function run() {
  console.log('Altering Stock Item to specify UNITS & BASEUNITS...');
  try {
    const res1 = await axios.post('http://localhost:9000', alterStockXml, { headers: { 'Content-Type': 'text/xml' } });
    console.log('Alter Stock Item Response raw:', res1.data);
    
    console.log('Importing inventory voucher again...');
    const res2 = await axios.post('http://localhost:9000', testVoucherXml, { headers: { 'Content-Type': 'text/xml' } });
    const parsed = await xml2js.parseStringPromise(res2.data, { explicitArray: false });
    console.log('Voucher Response:', JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
