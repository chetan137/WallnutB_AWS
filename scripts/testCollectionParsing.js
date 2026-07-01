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
    const parsed = await xml2js.parseStringPromise(res.data);
    const body = parsed?.ENVELOPE?.BODY?.[0];
    const data = body?.DATA?.[0];
    const collection = data?.COLLECTION?.[0];
    const vouchers = collection?.VOUCHER || [];
    
    console.log(`Total vouchers returned: ${vouchers.length}`);
    
    const records = [];
    
    vouchers.forEach((v, idx) => {
      try {
        const vchType = (v.VOUCHERTYPENAME?.[0] || '').trim();
        if (!/^(Sales|Credit Note)$/i.test(vchType)) return;
        
        const rawDate = v.DATE?.[0]?._ || v.DATE?.[0] || '';
        const date = rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate;
          
        const partyName = (v.PARTYLEDGERNAME?.[0]?._ || v.PARTYLEDGERNAME?.[0] || '').trim();
        const vchNo = (v.VOUCHERNUMBER?.[0] || `TLY-${idx}`).toString().trim();
        
        const narObj = v.NARRATION?.[0];
        const narration = (typeof narObj === 'string' ? narObj : (narObj?._ || '')).trim();
        
        const get = (key) => {
          const m = narration.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'));
          return m ? m[1].trim() : '';
        };
        
        const isStructured = /Item:/i.test(narration);
        if (!isStructured) return; // Only process our structured vouchers
        
        const itemName = get('Item');
        const qtyStr = get('Qty');
        const rateStr = get('Rate');
        const areaCity = get('Area');
        const salesMan = get('SO');
        const state = get('State');
        
        const qtyParts = qtyStr.split(/\s+/);
        const quantity = Math.abs(parseFloat(qtyParts[0]) || 0);
        const units = qtyParts.slice(1).join(' ') || '';
        const rate = parseFloat(rateStr) || 0;
        
        const ledgers = v['ALLLEDGERENTRIES.LIST'] || [];
        let amount = 0;
        for (const l of ledgers) {
          const amtObj = l.AMOUNT?.[0];
          const amtStr = typeof amtObj === 'string' ? amtObj : (amtObj?._ || amtObj || '0');
          const a = parseFloat(String(amtStr).replace(/,/g, ''));
          if (a !== 0) {
            amount = Math.abs(a);
            break;
          }
        }
        
        if (amount === 0 && quantity > 0 && rate > 0) amount = quantity * rate;
        
        records.push({
          vchNo,
          date,
          vchType,
          partyName,
          itemName,
          quantity,
          units,
          rate,
          amount,
          salesMan,
          areaCity,
          state,
          stockGroup: '',
          stockCategory: '',
          finalOutstanding: 0,
          _source: 'tally',
        });
      } catch (innerErr) {
        console.error('Error parsing single voucher:', innerErr.message);
      }
    });
    
    console.log(`Parsed ${records.length} structured vouchers successfully!`);
    if (records.length > 0) {
      console.log('Sample parsed record:', JSON.stringify(records[0], null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
