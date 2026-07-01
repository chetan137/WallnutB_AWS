const axios = require('axios');
const xml2js = require('xml2js');

async function importVoucher(label, xmlBody) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
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
            <DATE>20260601</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-DIAG-${label}</VOUCHERNUMBER>
            ${xmlBody}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post('http://localhost:9000', envelope, { headers: { 'Content-Type': 'text/xml' } });
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
    const created = parsed?.RESPONSE?.CREATED || '0';
    const exceptions = parsed?.RESPONSE?.EXCEPTIONS || '0';
    const errorText = parsed?.RESPONSE?.LINEERROR || '';
    console.log(`[${label}] -> Created: ${created} | Exceptions: ${exceptions} | Error: ${errorText}`);
    return parseInt(created) > 0;
  } catch (err) {
    console.log(`[${label}] -> Failed:`, err.message);
    return false;
  }
}

async function run() {
  console.log('Running Step-by-Step Tally Voucher diagnostics...');

  // Step 1: Voucher with "Test Debtor" and "Test Sales Ledger" (we know this works)
  const step1 = `
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
  `;
  await importVoucher('STEP-1-TEST-LEDGERS', step1);

  // Step 2: Voucher with REAL party "TOOLS PARK" and REAL sales ledger "Sales" (no inventory)
  const step2 = `
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>TOOLS PARK</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-1000</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>1000</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  `;
  await importVoucher('STEP-2-REAL-LEDGERS', step2);

  // Step 3: Voucher with "Test Debtor" and "Test Sales Ledger" and REAL Stock Item "Wallnut Floor Leveler (25 Kg)-FL"
  const step3 = `
    <PARTYLEDGERNAME>Test Debtor</PARTYLEDGERNAME>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Test Debtor</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-1000</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLINVENTORYENTRIES.LIST>
      <STOCKITEMNAME>Wallnut Floor Leveler (25 Kg)-FL</STOCKITEMNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <RATE>100/Kgs</RATE>
      <AMOUNT>1000</AMOUNT>
      <ACTUALQTY>10 Kgs</ACTUALQTY>
      <BILLEDQTY>10 Kgs</BILLEDQTY>
      <ACCOUNTINGALLOCATIONS.LIST>
        <LEDGERNAME>Test Sales Ledger</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>1000</AMOUNT>
      </ACCOUNTINGALLOCATIONS.LIST>
    </ALLINVENTORYENTRIES.LIST>
  `;
  await importVoucher('STEP-3-REAL-STOCK-ITEM', step3);
}

run();
