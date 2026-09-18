const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD
});

async function run() {
  try {
    const vchNo = 'WBSIGJ-129/24-25';
    const ledgers = await pool.query(`
      SELECT 
        vle.ledger_name,
        vle.amount
      FROM voucher_ledger_entries vle
      JOIN vouchers v ON v.id = vle.voucher_id
      WHERE v.vch_no = $1
    `, [vchNo]);
    console.log('TAX_AND_LEDGER_BREAKDOWN:', ledgers.rows);

    const lines = await pool.query(`
      SELECT 
        ROUND(SUM(vie.amount)::numeric, 2) as taxable_value_excl_gst
      FROM voucher_inventory_entries vie
      JOIN vouchers v ON v.id = vie.voucher_id
      WHERE v.vch_no = $1
    `, [vchNo]);
    console.log('SUM_OF_ITEM_LINES_EXCL_GST:', lines.rows[0]);
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
}

run();
