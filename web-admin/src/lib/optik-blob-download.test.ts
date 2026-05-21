import assert from 'node:assert/strict';
import { filenameFromContentDisposition } from './optik-blob-download';

assert.equal(
  filenameFromContentDisposition('attachment; filename="sinif-cetveli.pdf"'),
  'sinif-cetveli.pdf',
);

const enc = encodeURIComponent('oturum-özet.pdf');
assert.equal(
  filenameFromContentDisposition(`attachment; filename*=UTF-8''${enc}`),
  'oturum-özet.pdf',
);

console.log('optik-blob-download.test: ok');
