const fs = require('fs');

const path = 'C:\\Program Files\\TallyPrime\\tally.imp';
try {
  const content = fs.readFileSync(path, 'utf16le');
  const lines = content.split('\n');
  console.log('Total log lines:', lines.length);
  
  // Find lines that are not part of the standard summary
  let count = 0;
  lines.forEach((line, idx) => {
    const l = line.trim();
    if (!l) return;
    if (
      l.includes('Import Summary') ||
      l.includes('Created') ||
      l.includes('Altered') ||
      l.includes('Deleted') ||
      l.includes('Combined') ||
      l.includes('Ignored') ||
      l.includes('Errors') ||
      l.includes('Exceptions') ||
      l.startsWith('---') ||
      l.includes('Importing Data')
    ) {
      return;
    }
    console.log(`Line ${idx}: ${l}`);
    count++;
  });
  console.log('Printed', count, 'lines.');
} catch(e) {
  console.error(e);
}
