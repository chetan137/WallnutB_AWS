const axios = require('axios');
require('dotenv').config();
const config = require('../config');

async function main() {
  // Query using a Collection request
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <REPORT NAME="OpenCompaniesReport">
              <USE>Style Report</USE>
              <FORM>OpenCompaniesForm</FORM>
            </REPORT>
            <FORM NAME="OpenCompaniesForm">
              <PART>OpenCompaniesPart</PART>
            </FORM>
            <PART NAME="OpenCompaniesPart">
              <LINE>OpenCompaniesLine</LINE>
              <REPEAT>OpenCompaniesLine : OpenCompaniesCollection</REPEAT>
            </PART>
            <LINE NAME="OpenCompaniesLine">
              <FIELD>OpenCompaniesNameField</FIELD>
            </LINE>
            <FIELD NAME="OpenCompaniesNameField">
              <SET>$Name</SET>
            </FIELD>
            <COLLECTION NAME="OpenCompaniesCollection">
              <TYPE>Company</TYPE>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  try {
    const res = await axios.post(config.tally.baseUrl, xml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 10000,
    });
    console.log(res.data);
  } catch (e) {
    console.error('Error fetching companies:', e.message);
  }
}
main();
