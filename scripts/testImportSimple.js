const axios = require('axios');
const xml2js = require('xml2js');

// Get today's date in YYYYMMDD format
const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
console.log('Testing with date:', todayStr);

const voucherXml = `<?xml version="1.0" encoding="UTF-8"?>
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
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE">
            <DATE>${todayStr}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-TODAY</VOUCHERNUMBER>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Test Debtor</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-1000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Test Sales Ledger</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>1000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

async function run() {
  console.log('Sending simple voucher with today\'s date to Tally...');
  try {
    const res = await axios.post('http://localhost:9000', voucherXml, { headers: { 'Content-Type': 'text/xml' } });
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
    const body = parsed?.ENVELOPE?.BODY?.DATA;
    console.log('Voucher Response:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
