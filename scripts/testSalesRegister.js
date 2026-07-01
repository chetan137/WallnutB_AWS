const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();
const { buildSalesRegisterRequest } = require('../utils/xmlGenerator');

async function main() {
  // Try querying April 1 to June 30, 2026
  const xml = buildSalesRegisterRequest({ from: '2026-04-01', to: '2026-06-30' });

  console.log('XML request:');
  console.log(xml);

  try {
    const res = await axios.post('http://localhost:9000', xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 30000,
    });
    
    const parsed = await xml2js.parseStringPromise(res.data);
    const collection = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    const vouchers = collection?.VOUCHER || [];
    
    console.log(`\nTotal sales vouchers returned: ${vouchers.length}`);
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
