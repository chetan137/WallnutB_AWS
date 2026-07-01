// Detect the exact company name open in Tally right now
const axios = require('axios');

async function run() {
  // Export company list — works without specifying a company
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Company</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const r = await axios.post('http://localhost:9000', xml, {
    headers: {'Content-Type': 'text/xml;charset=UTF-8'}, timeout: 10000
  });
  const raw = String(r.data);
  console.log('=== COMPANY LIST (first 2000 chars) ===');
  console.log(raw.slice(0, 2000));

  // Extract company names
  const names = [...raw.matchAll(/<NAME>(.*?)<\/NAME>/gi)].map(m => m[1]);
  const compNames = [...raw.matchAll(/NAME="([^"]+)"/gi)].map(m => m[1]);
  console.log('\n=== Company names found ===');
  console.log('From NAME tags:', names);
  console.log('From NAME attr:', compNames);
}
run().catch(e => console.log('ERROR:', e.code, e.message));
