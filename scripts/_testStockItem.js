// Check what company is currently open in Tally
require('dotenv').config();
const axios = require('axios');

async function run() {
  // Test 1: Voucher WITHOUT SVCURRENTCOMPANY (uses whatever is open)
  const xml1 = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>NOCOMPANY-TEST-001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>TOOLS PARK</PARTYLEDGERNAME>
            <NARRATION>Test without SVCURRENTCOMPANY</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TOOLS PARK</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-5000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>5000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  console.log('=== TEST 1: No SVCURRENTCOMPANY (use whatever is open) ===');
  const r1 = await axios.post('http://localhost:9000', xml1, {
    headers: {'Content-Type': 'text/xml;charset=UTF-8'}, timeout: 10000
  });
  console.log(String(r1.data));

  // Test 2: INVOICE format without company spec
  const xml2 = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE">
            <DATE>20260401</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>INVOICE-NOCOMP-001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>TOOLS PARK</PARTYLEDGERNAME>
            <ISINVOICE>Yes</ISINVOICE>
            <NARRATION>Invoice test no company</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TOOLS PARK</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-20720</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>Wallnut Floor Leveler (25 Kg)-FL</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>560/Kgs</RATE>
              <AMOUNT>-20720</AMOUNT>
              <ACTUALQTY>37 Kgs</ACTUALQTY>
              <BILLEDQTY>37 Kgs</BILLEDQTY>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Sales</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>-20720</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  console.log('\n=== TEST 2: INVOICE format, no SVCURRENTCOMPANY ===');
  const r2 = await axios.post('http://localhost:9000', xml2, {
    headers: {'Content-Type': 'text/xml;charset=UTF-8'}, timeout: 10000
  });
  console.log(String(r2.data));
}
run().catch(e => console.log('ERROR:', e.message));
