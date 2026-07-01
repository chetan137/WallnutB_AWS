const axios = require('axios');
const xml2js = require('xml2js');

const years = [2022, 2023, 2024, 2025, 2026, 2027];

async function testYear(year) {
  const dateStr = `${year}0415`; // April 15 of that year
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
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-${year}</VOUCHERNUMBER>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Test Debtor</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-100</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Test Sales Ledger</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>100</AMOUNT>
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
    console.log(`Year ${year} (${dateStr}) -> Created: ${created} | Exceptions: ${exceptions}`);
    return parseInt(created) > 0;
  } catch (err) {
    console.log(`Year ${year} -> Request failed:`, err.message);
    return false;
  }
}

async function run() {
  console.log('Testing different years to find Tally\'s active financial year period...');
  for (const year of years) {
    await testYear(year);
  }
}

run();
