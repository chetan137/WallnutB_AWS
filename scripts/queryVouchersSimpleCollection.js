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
      </REQUESTDESC>
      <REQUESTDATA>
        <COLLECTION NAME="Voucher">
        </COLLECTION>
      </REQUESTDATA>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 30000,
    });
    console.log('Raw XML Response length:', res.data.length);
    const parsed = await xml2js.parseStringPromise(res.data);
    const body = parsed?.ENVELOPE?.BODY?.[0];
    const data = body?.DATA?.[0];
    const collection = data?.COLLECTION?.[0];
    const vouchers = collection?.VOUCHER || [];
    console.log(`Vouchers returned: ${vouchers.length}`);
    if (vouchers.length > 0) {
      console.log('First 5 vouchers:');
      for (let i = 0; i < Math.min(5, vouchers.length); i++) {
        const v = vouchers[i];
        console.log(`  VchNo: ${v.VOUCHERNUMBER?.[0]} | Date: ${v.DATE?.[0]} | Party: ${v.PARTYLEDGERNAME?.[0]} | Narration: "${v.NARRATION?.[0]}"`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
