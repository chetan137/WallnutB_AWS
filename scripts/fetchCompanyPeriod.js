const axios = require('axios');
const xml2js = require('xml2js');

const queryXml = `<?xml version="1.0" encoding="UTF-8"?>
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

axios.post('http://localhost:9000', queryXml, { headers: { 'Content-Type': 'text/xml' } })
  .then(async r => {
    const parsed = await xml2js.parseStringPromise(r.data);
    console.log('Company collection response length:', r.data.length);
    const company = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;
    if (company) {
      const list = Array.isArray(company) ? company : [company];
      list.forEach(c => {
        console.log('Company Name:', c.NAME || c.$.NAME);
        console.log('  Books Beginning From:', c.BOOKSBEGINNINGFROM);
        console.log('  Financial Year From: ', c.STARTINGFROM);
      });
    } else {
      console.log('Could not parse Company details from response.');
      console.log(r.data.substring(0, 1000));
    }
  })
  .catch(e => console.error(e.message));
