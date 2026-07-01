const axios = require('axios');
const xml2js = require('xml2js');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Wallnut2</SVCURRENTCOMPANY>
          <SVFROMDATE>20250401</SVFROMDATE>
          <SVTODATE>20260331</SVTODATE>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

async function main() {
  try {
    const r = await axios.post('http://localhost:9000', xml, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 15000,
    });
    const parsed = await xml2js.parseStringPromise(r.data, {
      explicitArray: true, ignoreAttrs: false, trim: true, normalize: true,
    });

    const msgs = parsed.ENVELOPE.BODY[0].IMPORTDATA[0].REQUESTDATA[0].TALLYMESSAGE;
    console.log(`Total TALLYMESSAGE: ${msgs.length}`);

    // Print all keys of first voucher to find inventory
    const v = msgs[0].VOUCHER[0];
    const allKeys = Object.keys(v);
    console.log('\nAll voucher keys containing "INV" or "STOCK" or "ITEM":');
    console.log(allKeys.filter(k => /INV|STOCK|ITEM/i.test(k)));

    console.log('\nAll voucher keys (full list):');
    console.log(allKeys);

    // Print narration for all vouchers
    console.log('\n=== ALL VOUCHER NARRATIONS + KEY DATA ===');
    msgs.forEach((msg, i) => {
      const vch = msg.VOUCHER?.[0];
      if (!vch) return;
      const narr = (vch.NARRATION?.[0] || '').trim();
      const vchNo = vch.VOUCHERNUMBER?.[0] || '';
      const date  = vch.DATE?.[0] || '';
      const party = vch.PARTYLEDGERNAME?.[0] || '';
      const type  = vch.VOUCHERTYPENAME?.[0] || '';
      
      // Check ledger amount
      const ledgers = vch['ALLLEDGERENTRIES.LIST'] || [];
      const amounts = ledgers.map(l => l.AMOUNT?.[0] || '0');
      
      console.log(`[${i}] #${vchNo} ${date} ${type} | ${party} | amounts: ${amounts.join(', ')}`);
      console.log(`     Narr: ${narr}`);
    });

  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
main();
