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
    
    let totalNarrations = 0;
    let structuredNarrations = 0;
    const sampleNarrations = [];
    
    for (const v of vouchers) {
      const narObj = v.NARRATION?.[0];
      let narrationText = '';
      if (typeof narObj === 'string') {
        narrationText = narObj;
      } else if (narObj && typeof narObj === 'object') {
        narrationText = narObj._ || '';
      }
      
      if (narrationText.trim()) {
        totalNarrations++;
        if (/Item:/i.test(narrationText)) {
          structuredNarrations++;
          if (sampleNarrations.length < 5) {
            sampleNarrations.push({
              vchNo: v.VOUCHERNUMBER?.[0],
              date: v.DATE?.[0]?._ || v.DATE?.[0],
              party: v.PARTYLEDGERNAME?.[0]?._ || v.PARTYLEDGERNAME?.[0],
              narration: narrationText
            });
          }
        }
      }
    }
    
    console.log(`Total vouchers: ${vouchers.length}`);
    console.log(`Vouchers with non-empty narration: ${totalNarrations}`);
    console.log(`Vouchers with structured "Item:" narration: ${structuredNarrations}`);
    console.log('\nSample structured narrations:');
    console.log(JSON.stringify(sampleNarrations, null, 2));
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
