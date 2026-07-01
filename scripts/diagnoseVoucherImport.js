const axios = require('axios');
const xml2js = require('xml2js');
const { salesData } = require('../data');
const { buildVoucherXml, buildImportEnvelope } = require('../utils/xmlGenerator');

// We will test importing the very first voucher from salesData (modified to use April 1st, 2026)
const txn = { ...salesData[0], date: '2026-04-01', vchNo: 'DIAG-001/26-27' };
const voucherXml = buildVoucherXml(txn, 'CREATE');
const envelopeXml = buildImportEnvelope([voucherXml]);

console.log('--- TEST XML VOUCHER ---');
console.log(voucherXml);
console.log('--- END TEST XML VOUCHER ---');

axios.post('http://localhost:9000', envelopeXml, { headers: { 'Content-Type': 'text/xml;charset=UTF-8' } })
  .then(r => {
    console.log('--- TALLY RAW RESPONSE ---');
    console.log(r.data);
    console.log('--- END TALLY RAW RESPONSE ---');
  })
  .catch(e => {
    console.error('Error contacting Tally:', e.message);
  });
