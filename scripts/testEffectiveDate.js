const axios = require('axios');
const xml2js = require('xml2js');

async function test(dateStr) {
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
            <DATE>${dateStr}</DATE>
            <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-EFF-${dateStr}</VOUCHERNUMBER>
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

  try {
    const res = await axios.post('http://localhost:9000', voucherXml, { headers: { 'Content-Type': 'text/xml' } });
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
    const created = parsed?.RESPONSE?.CREATED || '0';
    const exceptions = parsed?.RESPONSE?.EXCEPTIONS || '0';
    const errorText = parsed?.RESPONSE?.LINEERROR || '';
    console.log(`Date ${dateStr} -> Created: ${created} | Exceptions: ${exceptions} | Error: ${errorText}`);
  } catch (err) {
    console.log(`Date ${dateStr} -> Failed:`, err.message);
  }
}

async function run() {
  console.log('Testing with EFFECTIVEDATE tag...');
  await test('20250415');
  await test('20260620');
}

run();
