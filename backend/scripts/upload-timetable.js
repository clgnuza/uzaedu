/**
 * Test ders programını backend'e yükler.
 */
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const https = require('https');
const http = require('http');

const TOKEN = '0c6cf4d6-72e8-4d1c-8a9a-5694b7ce88db';
const FILE_PATH = path.join(__dirname, 'test-timetable-gapful.xlsx');
const URL = 'http://localhost:4000/api/teacher-timetable/upload';

const form = new FormData();
form.append('file', fs.createReadStream(FILE_PATH), {
  filename: 'test-timetable-gapful.xlsx',
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

const headers = {
  ...form.getHeaders(),
  Authorization: `Bearer ${TOKEN}`,
};

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/teacher-timetable/upload',
  method: 'POST',
  headers,
};

console.log('Yükleniyor:', FILE_PATH);

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('Yanıt status:', res.statusCode);
    try {
      console.log('Yanıt:', JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log('Yanıt (ham):', data);
    }
  });
});

req.on('error', (err) => {
  console.error('Hata:', err.message);
});

form.pipe(req);
