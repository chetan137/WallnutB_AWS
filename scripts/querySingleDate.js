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
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${config.tally.companyName}</SVCURRENTCOMPANY>
          <SVFROMDATE>20260401</SVFROMDATE>
          <SVTODATE>20260401</SVTODATE>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 10000,
    });
    console.log('Raw XML Response length:', res.data.length);
    const parsed = await xml2js.parseStringPromise(res.data);
    const collection = parsed?.ENVELOPE?.BODY?.[0]?.DATA?.[0]?.COLLECTION?.[0];
    const vouchers = collection?.VOUCHER || [];
    console.log(`Vouchers returned for 20260401: ${vouchers.length}`);
    if (vouchers.length > 0) {
      console.log(JSON.stringify(vouchers.map(v => ({
        vchNo: v.VOUCHERNUMBER?.[0],
        date: v.DATE?.[0],
        party: v.PARTYLEDGERNAME?.[0],
        narration: v.NARRATION?.[0],
      })), null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
