const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();
const config = require('../config');

async function main() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>AllVouchersCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${config.tally.companyName}</SVCURRENTCOMPANY>
        <SVFROMDATE>20260401</SVFROMDATE>
        <SVTODATE>20270331</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="AllVouchersCollection" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes">
            <TYPE>Voucher</TYPE>
            <FETCH>VoucherNumber, Date, VoucherTypeName, PartyLedgerName, Narration</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 60000,
    });
    
    const parsed = await xml2js.parseStringPromise(res.data);
    const body = parsed?.ENVELOPE?.BODY?.[0];
    const data = body?.DATA?.[0];
    const collection = data?.COLLECTION?.[0];
    const vouchers = collection?.VOUCHER || [];
    
    console.log(`Total vouchers parsed: ${vouchers.length}`);
    if (vouchers.length > 0) {
      console.log('\nKeys on first voucher object:', Object.keys(vouchers[0]));
      console.log('\nFirst voucher object:', JSON.stringify(vouchers[0], null, 2));
      
      // Let's search if any voucher has a VOUCHERNUMBER
      const withVchNo = vouchers.filter(v => v.VOUCHERNUMBER?.[0]);
      console.log(`\nNumber of vouchers with VOUCHERNUMBER parsed: ${withVchNo.length}`);
      if (withVchNo.length > 0) {
        console.log('Sample VchNos:', withVchNo.slice(0, 5).map(v => v.VOUCHERNUMBER?.[0]));
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
