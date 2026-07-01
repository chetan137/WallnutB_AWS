const axios = require('axios');
const xml2js = require('xml2js');

const alterLedgersXml = `<?xml version="1.0" encoding="UTF-8"?>
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
          <LEDGER NAME="Sales" ACTION="ALTER">
            <NAME>Sales</NAME>
            <PARENT>Sales Accounts</PARENT>
            <ISINVENTORYAFFECTED>Yes</ISINVENTORYAFFECTED>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Sales Returns" ACTION="ALTER">
            <NAME>Sales Returns</NAME>
            <PARENT>Sales Accounts</PARENT>
            <ISINVENTORYAFFECTED>Yes</ISINVENTORYAFFECTED>
          </LEDGER>
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
            <VOUCHERNUMBER>TEST-NEST-INVENTORY-OK</VOUCHERNUMBER>
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
  console.log('Altering Sales ledgers to enable ISINVENTORYAFFECTED=Yes...');
  try {
    const res1 = await axios.post('http://localhost:9000', alterLedgersXml, { headers: { 'Content-Type': 'text/xml' } });
    console.log('Alter Ledgers Response raw:', res1.data);
    
    console.log('Importing inventory voucher again...');
    const res2 = await axios.post('http://localhost:9000', testVoucherXml, { headers: { 'Content-Type': 'text/xml' } });
    const parsed = await xml2js.parseStringPromise(res2.data, { explicitArray: false });
    console.log('Voucher Response:', JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
