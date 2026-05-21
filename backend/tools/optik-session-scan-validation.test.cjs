/**
 * createSessionScan öğrenci zorunluluğu — servis mantığı özeti (build sonrası manuel doğrulama notu).
 * Asıl doğrulama: integration; burada yalnızca migration dosyalarının varlığı.
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const mig = path.join(__dirname, '..', 'migrations', 'add-optik-exam-sessions.sql');
assert.ok(fs.existsSync(mig), 'add-optik-exam-sessions.sql eksik');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'optik', 'optik-sessions.service.ts'),
  'utf8',
);
assert.match(src, /Sınıf oturumunda öğrenci seçimi zorunludur/);

console.log('optik-session-scan-validation.test: ok');
