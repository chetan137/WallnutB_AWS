const fs = require('fs');

const path = 'C:\\Program Files\\TallyPrime\\tally.imp';
try {
  let stats = fs.statSync(path);
  console.log('File size:', stats.size);
  
  // Read last 4000 bytes
  const fd = fs.openSync(path, 'r');
  const buffer = Buffer.alloc(4000);
  const position = Math.max(0, stats.size - 4000);
  fs.readSync(fd, buffer, 0, 4000, position);
  fs.closeSync(fd);
  
  // Try UTF-16LE first
  let text = buffer.toString('utf16le');
  console.log('--- UTF-16LE last 1000 chars ---');
  console.log(text.substring(text.length - 1000));
  
  // Try UTF-8/ANSI
  let text8 = buffer.toString('utf8');
  console.log('--- UTF-8 last 1000 chars ---');
  console.log(text8.substring(text8.length - 1000));
} catch(e) {
  console.error(e);
}
