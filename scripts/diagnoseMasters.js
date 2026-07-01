const axios = require('axios');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Wallnut</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <UNIT NAME="Kgs" ACTION="CREATE">
            <SYMBOL>Kgs</SYMBOL>
            <NAME>Kgs</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          </UNIT>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

axios.post('http://localhost:9000', xml, { headers: { 'Content-Type': 'text/xml' } })
  .then(r => {
    console.log('Raw response:');
    console.log(r.data);
  })
  .catch(e => console.error(e.message));
