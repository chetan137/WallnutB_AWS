const axios = require('axios');
const xml2js = require('xml2js');

async function testSign(label, invAmt, accAmt) {
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
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE" OBJVIEW="Invoice Voucher View">
            <DATE>20260601</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-SIGN-${label}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>TOOLS PARK</PARTYLEDGERNAME>
            
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TOOLS PARK</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-1000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>Wallnut Floor Leveler (25 Kg)-FL</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>100/Kgs</RATE>
              <AMOUNT>${invAmt}</AMOUNT>
              <ACTUALQTY>10 Kgs</ACTUALQTY>
              <BILLEDQTY>10 Kgs</BILLEDQTY>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Sales</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>${accAmt}</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
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
    console.log(`[${label}] InvAmt: ${invAmt}, AccAmt: ${accAmt} -> Created: ${created} | Exceptions: ${exceptions}`);
  } catch (err) {
    console.log(`[${label}] -> Failed:`, err.message);
  }
}

async function run() {
  console.log('Testing sign combinations in inventory voucher with inventory-enabled Sales ledger...');
  await testSign('INV-POS-ACC-POS', '1000', '1000');
  await testSign('INV-NEG-ACC-POS', '-1000', '1000');
  await testSign('INV-NEG-ACC-NEG', '-1000', '-1000');
  await testSign('INV-POS-ACC-NEG', '1000', '-1000');
}

run();
