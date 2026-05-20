const fs = require('fs');
const FormData = require('form-data');
const http = require('http');

const pdfFile = 'c:\\Users\\mehme\\Downloads\\eokulrapor\\OOK11003R010 Öğretmen Ders Programları 2026-04-29 pmt 15.49.10.pdf';
const xlsFile = 'c:\\Users\\mehme\\Downloads\\eokulrapor\\OOK11003R010 Öğretmen Ders Programları 2026-04-29 pmt 15.49.25.xls';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3MzUyODAxYS1jMjcwLTQwMDAtODAwMC0wMDAwMDAwMDAzMTAiLCJzY2hvb2xJZCI6IjBiMTFmNmQ1LTdkOWYtNDAwMC04MDAwLTAwMDAwMDAwMDIwMSIsInVzZXIiOnsiaWQiOiI3MzUyODAxYS1jMjcwLTQwMDAtODAwMC0wMDAwMDAwMDAzMTAiLCJyb2xlIjoic2Nob29sX2FkbWluIn0sImlhdCI6MTcxNjAyMDAwMH0.fake';

async function test(file, label) {
  return new Promise((resolve) => {
    const form = new FormData();
    form.append('file', fs.createReadStream(file));
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/teacher-timetable/upload',
      method: 'POST',
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`\n✓ ${label}:`, json.imported || 0, 'entries', json.errors?.length || 0, 'errors');
          if (json.errors?.slice(0, 2)) console.log('  Errors:', json.errors.slice(0, 2));
        } catch {
          console.log(`✗ ${label}: ${data.slice(0, 120)}`);
        }
        resolve();
      });
    });
    form.pipe(req);
  });
}

(async () => {
  console.log('Testing PDF...');
  await test(pdfFile, 'PDF');
  await new Promise(r => setTimeout(r, 1000));
  console.log('\nTesting XLS...');
  await test(xlsFile, 'XLS');
  console.log('\nDone.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
