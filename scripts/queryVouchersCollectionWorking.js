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

  console.log(`Querying Voucher Collection from Tally...`);
  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 60000,
    });
    
    console.log('Raw XML Response length:', res.data.length);
    
    // Check if RESPONSE contains error
    if (res.data.includes('Unknown Request')) {
      console.log('Tally returned Unknown Request error');
      return;
    }
    
    // Parse response
    const parsed = await xml2js.parseStringPromise(res.data);
    
    // Look at returned collections
    const envelope = parsed?.ENVELOPE;
    // Tally returns the vouchers under the collection ID tag or inside BODY/DATA
    // Let's print the top level keys to inspect
    console.log('Envelope Keys:', Object.keys(envelope || {}));
    
    // Tally typically returns: <ENVELOPE><VOUCHER>...</VOUCHER></ENVELOPE> or similar
    const vouchers = envelope?.VOUCHER || [];
    console.log(`Vouchers found at root level: ${vouchers.length}`);
    
    const dateCounts = {};
    const typeCounts = {};
    const sample = [];
    
    for (const v of vouchers) {
      const date = (v.DATE?.[0] || '').trim();
      const vchNo = (v.VOUCHERNUMBER?.[0] || '').trim();
      const narration = (v.NARRATION?.[0] || '').trim();
      const type = (v.VOUCHERTYPENAME?.[0] || '').trim();
      
      dateCounts[date] = (dateCounts[date] || 0) + 1;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      if (sample.length < 10) {
        sample.push({ date, vchNo, type, narration });
      }
    }
    
    console.log('\nDate Counts:', dateCounts);
    console.log('\nVoucher Type Counts:', typeCounts);
    console.log('\nSample Vouchers (First 10):');
    console.log(JSON.stringify(sample, null, 2));
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main().catch(console.error);
