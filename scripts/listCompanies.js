const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();
const config = require('../config');

async function main() {
  const xml = `<?xml version="1.0"?><ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
  const res = await axios.post(config.tally.baseUrl, xml, {
    headers: { 'Content-Type': 'text/xml' },
  });
  const parsed = await xml2js.parseStringPromise(res.data);
  console.log(JSON.stringify(parsed, null, 2));
}
main().catch(console.error);
