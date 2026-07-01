const axios = require('axios');
const xml2js = require('xml2js');

const formats = [
  { label: 'YYYYMMDD', date: '20260620' },
  { label: 'DD-MMM-YYYY', date: '20-Jun-2026' },
  { label: 'DD-MM-YYYY', date: '20-06-2026' },
  { label: 'YYYY-MM-DD', date: '2026-06-20' },
  { label: 'DD/MM/YYYY', date: '20/06/2026' }
];

async function testFormat(fmt) {
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
            <DATE>${fmt.date}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-${fmt.label}</VOUCHERNUMBER>
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
    console.log(`Format ${fmt.label} (${fmt.date}) -> Created: ${created} | Exceptions: ${exceptions} | Error: ${errorText}`);
  } catch (err) {
    console.log(`Format ${fmt.label} -> Failed:`, err.message);
  }
}

async function run() {
  console.log('Testing different Tally date formats...');
  for (const fmt of formats) {
    await testFormat(fmt);
  }
}

run();
