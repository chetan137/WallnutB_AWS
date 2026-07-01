/**
 * scripts/runImport.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone CLI script to trigger the full Tally import from data.js.
 * Run directly: node scripts/runImport.js
 *
 * Output: coloured log + final summary table in the terminal.
 */

'use strict';

const { importAllVouchers } = require('../services/tallyImportService');
const logger = require('../utils/logger');

(async () => {
  logger.info('═══════════════════════════════════════════════════');
  logger.info('  Wallnut → Tally Prime Voucher Import');
  logger.info('═══════════════════════════════════════════════════');

  try {
    const result = await importAllVouchers();

    console.log('\n');
    logger.info('═══════════════ IMPORT SUMMARY ════════════════════');
    logger.info(`  Total records : ${result.totalRecords}`);
    logger.info(`  Batches sent  : ${result.batches}`);
    logger.success(`  Imported (new): ${result.imported}`);
    logger.warn(`  Updated (dup) : ${result.duplicates}`);
    logger.error(`  Failed        : ${result.failed}`);
    logger.info(`  Duration      : ${result.durationMs}ms`);
    logger.info('═══════════════════════════════════════════════════');

    if (result.failed > 0) {
      logger.warn('\n  Failed details:');
      result.details
        .filter((d) => /error|fail|LINEERROR/i.test(d))
        .slice(0, 20)
        .forEach((d) => logger.error(`    ${d}`));
    }

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (err) {
    logger.error('Fatal import error.', { message: err.message });
    process.exit(1);
  }
})();
