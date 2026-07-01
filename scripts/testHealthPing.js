const axios = require('axios');
require('dotenv').config();
const config = require('../config');

async function main() {
  const pingXml = `<?xml version="1.0"?><ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`;
  try {
    const res = await axios.post(config.tally.baseUrl, pingXml, {
      headers: { 'Content-Type': 'text/xml' },
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.message);
  }
}
main();
