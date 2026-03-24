const fs = require('fs');
const path = require('path');
const xml = fs.readFileSync(
  path.join(__dirname, '..', 'templates', 'plan-ornek-extracted', 'word', 'document.xml'),
  'utf8'
);
const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
const texts = textMatches.map((m) => m.replace(/<[^>]+>/g, '').trim()).filter((t) => t.length > 0);
console.log('First 100 text segments:\n');
texts.slice(0, 100).forEach((t, i) => console.log((i + 1).toString().padStart(3), t.substring(0, 70)));
console.log('\n--- Table/grid structure (tcW = cell width) ---');
const gridCols = xml.match(/<w:gridCol[^>]*w:w="(\d+)"/g);
if (gridCols) console.log('Grid cols:', gridCols.slice(0, 20).join(', '));
