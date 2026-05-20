/**
 * Yerel smoke: QR create → poll → exchange (+ session-status)
 * node tools/test-classroom-qr-exchange.js
 */
const http = require('http');

const API = process.env.API_BASE || 'http://127.0.0.1:4000/api';
const SCHOOL_ID = process.env.SCHOOL_ID || '';
const DEVICE_ID = process.env.DEVICE_ID || '';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(API + path);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  if (!SCHOOL_ID || !DEVICE_ID) {
    console.error('SCHOOL_ID ve DEVICE_ID gerekli');
    process.exit(1);
  }
  const ip = await request('GET', `/tv/classroom-client-ip?school_id=${encodeURIComponent(SCHOOL_ID)}`);
  console.log('client-ip', ip.status, ip.json);

  const create = await request('POST', '/tv/classroom-qr-session', {
    school_id: SCHOOL_ID,
    device_id: DEVICE_ID,
  });
  console.log('create', create.status, create.json);
  if (create.status !== 201 && create.status !== 200) process.exit(2);

  const sid = create.json.session_id;
  const poll = await request(
    'GET',
    `/tv/classroom-qr-session/${encodeURIComponent(sid)}/poll?school_id=${encodeURIComponent(SCHOOL_ID)}&device_id=${encodeURIComponent(DEVICE_ID)}`,
  );
  console.log('poll', poll.status, poll.json);
  if (poll.json.access_token) {
    console.error('FAIL: poll access_token');
    process.exit(3);
  }

  const st = await request(
    'GET',
    `/tv/classroom-session-status?school_id=${encodeURIComponent(SCHOOL_ID)}&device_id=${encodeURIComponent(DEVICE_ID)}`,
  );
  console.log('session-status', st.status, st.json);

  const link = `http://localhost:3000/akilli-tahta?qr_school=${SCHOOL_ID}&qr_device=${DEVICE_ID}&qr_session=${sid}&qr_code=${create.json.code}`;
  const img = await request('GET', `/tv/classroom-qr-image?url=${encodeURIComponent(link)}`);
  console.log('qr-image', img.status, img.json.raw ? 'err' : 'ok');
  if (img.status !== 200) process.exit(4);

  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
