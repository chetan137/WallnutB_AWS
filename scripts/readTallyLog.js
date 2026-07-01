/**
 * scripts/readTallyLog.js
 * Reads and prints exception messages from tally.imp
 */
const fs = require('fs');

try {
  const content = fs.readFileSync('C:\\Program Files\\TallyPrime\\tally.imp', 'utf16le'); // Tally logs are often UTF-16LE or ANSI
  const lines = content.split('\n');
  
  console.log('=== Tally Log Tail ===');
  // Get lines containing errors or exceptions details (usually lines before "Import Summary")
  let count = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line && !line.includes('Import Summary') && !line.includes('Created') && !line.includes('Altered') && !line.includes('Deleted') && !line.includes('Combined') && !line.includes('Ignored') && !line.includes('Errors') && !line.includes('Exceptions') && !line.includes('-----') && !line.includes('Importing Data')) {
      console.log(line);
      count++;
      if (count > 40) break;
    }
  }
} catch (e) {
  console.error('Error reading log:', e.message);
  // Try reading with default utf8 if utf16le fails
  try {
    const content = fs.readFileSync('C:\\Program Files\\TallyPrime\\tally.imp', 'utf8');
    const lines = content.split('\n');
    console.log('=== Tally Log Tail (UTF-8) ===');
    let count = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.includes('Import Summary') && !line.includes('Created') && !line.includes('Altered') && !line.includes('Deleted') && !line.includes('Combined') && !line.includes('Ignored') && !line.includes('Errors') && !line.includes('Exceptions') && !line.includes('-----') && !line.includes('Importing Data')) {
        console.log(line);
        count++;
        if (count > 40) break;
      }
    }
  } catch (err) {
    console.error('Error reading log in UTF-8:', err.message);
  }
}
