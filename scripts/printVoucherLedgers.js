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
            <FETCH>VoucherNumber, Date, VoucherTypeName, PartyLedgerName, Narration, AllLedgerEntries.*</FETCH>
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
    
    // Find a voucher that has structured narration and print its ledger list
    const sampleVoucher = vouchers.find(v => {
      const narObj = v.NARRATION?.[0];
      const narrationText = typeof narObj === 'string' ? narObj : (narObj?._ || '');
      return /Item:/i.test(narrationText);
    });
    
    if (sampleVoucher) {
      console.log('Found structured voucher:');
      console.log('Keys:', Object.keys(sampleVoucher));
      console.log('Voucher Details:', JSON.stringify(sampleVoucher, null, 2));
    } else {
      console.log('No structured voucher found in the first batch.');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
