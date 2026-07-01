const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();
const config = require('../config');

async function main() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${config.tally.companyName}</SVCURRENTCOMPANY>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="MyVoucherCollection">
              <TYPE>Voucher</TYPE>
              <METHOD>VchNo: $VOUCHERNUMBER</METHOD>
              <METHOD>VchDate: $DATE</METHOD>
              <METHOD>VchTypeName: $VOUCHERTYPENAME</METHOD>
              <METHOD>PartyName: $PARTYLEDGERNAME</METHOD>
              <METHOD>NarrationText: $NARRATION</METHOD>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
      <REQUESTDATA>
        <COLLECTION NAME="MyVoucherCollection"/>
      </REQUESTDATA>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  console.log(`Querying Voucher Collection from Tally for company ${config.tally.companyName}...`);
  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 30000,
    });
    
    console.log('Raw XML Response from Tally:', res.data);
    
    // Parse response
    const parsed = await xml2js.parseStringPromise(res.data);
    
    // The structure returned is COLLECTION.VOUCHER
    const collection = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    const vouchers = collection?.VOUCHER || [];
    
    console.log(`\nTotal vouchers returned: ${vouchers.length}`);
    
    const dateCounts = {};
    const typeCounts = {};
    const sampleVouchers = [];
    
    for (const v of vouchers) {
      // Methods are exported as child elements or attributes
      const date = (v.VCHDATE?.[0] || '').trim();
      const vchNo = (v.VCHNO?.[0] || '').trim();
      const narration = (v.NARRATIONTEXT?.[0] || '').trim();
      const type = (v.VCHTYPENAME?.[0] || '').trim();
      
      dateCounts[date] = (dateCounts[date] || 0) + 1;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      if (sampleVouchers.length < 15) {
        sampleVouchers.push({ date, vchNo, type, narration });
      }
    }
    
    console.log('\nDate Counts:', dateCounts);
    console.log('\nVoucher Type Counts:', typeCounts);
    console.log('\nSample Vouchers (First 15):');
    console.log(JSON.stringify(sampleVouchers, null, 2));
    
  } catch (e) {
    console.error('Error querying collection:', e.message);
  }
}

main().catch(console.error);
