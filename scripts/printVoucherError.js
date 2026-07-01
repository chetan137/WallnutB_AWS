const axios = require('axios');

const voucherXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Wallnut</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="CREATE" OBJVIEW="Invoice Voucher View">
            <DATE>20260601</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>TEST-NEST-ERR-2</VOUCHERNUMBER>
            <PARTYLEDGERNAME>TOOLS PARK</PARTYLEDGERNAME>
            
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>TOOLS PARK</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-1000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>Wallnut Floor Leveler (25 Kg)-FL</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <RATE>100/Kgs</RATE>
              <AMOUNT>1000</AMOUNT>
              <ACTUALQTY>10 Kgs</ACTUALQTY>
              <BILLEDQTY>10 Kgs</BILLEDQTY>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Sales</LEDGERNAME>
                <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                <AMOUNT>1000</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

axios.post('http://localhost:9000', voucherXml, { headers: { 'Content-Type': 'text/xml' } })
  .then(r => {
    console.log('Tally Raw Response for nested voucher with inventory-enabled Sales ledger:');
    console.log(r.data);
  })
  .catch(e => console.error(e.message));
