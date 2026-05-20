/**
 * Yerel: login + upload-gpt-reconcile + parser özeti
 * node tools/test-gpt-reconcile-upload.js
 */
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const PDF = process.env.EOKUL_PDF ||
  'c:\\Users\\mehme\\Downloads\\eokulrapor\\OOK11003R010 Öğretmen Ders Programları 2026-04-29 pmt 15.49.10.pdf';
const XLS = process.env.EOKUL_XLS ||
  'c:\\Users\\mehme\\Downloads\\eokulrapor\\OOK11003R010 Öğretmen Ders Programları 2026-04-29 pmt 15.49.25.xls';
const API = process.env.API_BASE || 'http://127.0.0.1:4000/api';

function requestJson(method, urlPath, body, token, headersExtra = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(API + urlPath);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headersExtra,
        },
        timeout: 300000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch { /* */ }
          resolve({ status: res.statusCode, json, raw: data });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

function uploadReconcile(token) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(PDF)) return reject(new Error('PDF yok: ' + PDF));
    if (!fs.existsSync(XLS)) return reject(new Error('XLS yok: ' + XLS));
    const form = new FormData();
    form.append('file_pdf', fs.createReadStream(PDF));
    form.append('file_xls', fs.createReadStream(XLS));
    const previewQ = process.env.PREVIEW === '0' ? '' : '?preview=1';
    const u = new URL(API + '/teacher-timetable/upload-gpt-reconcile' + previewQ);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
        timeout: 300000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch { /* */ }
          resolve({ status: res.statusCode, json, raw: data });
        });
      },
    );
    req.on('error', reject);
    form.pipe(req);
  });
}

async function main() {
  console.log('=== Parser (yerel, OpenAI yok) ===');
  const dist = path.join(__dirname, '..', 'dist', 'teacher-timetable', 'timetable-reconcile');
  const { parseEokulInstitutionalXls } = require(path.join(dist, 'eokul-xls-grid'));
  const { parseEokulTeacherPdf } = require(path.join(dist, 'eokul-pdf-teachers'));
  const xls = parseEokulInstitutionalXls(XLS);
  const pdf = await parseEokulTeacherPdf(PDF);
  console.log('XLS:', xls.meta);
  console.log('PDF:', pdf.meta, 'örnek öğretmen:', pdf.teachers[0]?.teacher, 'slot:', pdf.teachers[0]?.slots?.length);
  const days = new Set(xls.records.map((r) => r.day).filter(Boolean));
  console.log('XLS günler:', [...days].join(', '));

  console.log('\n=== API health ===');
  const health = await requestJson('GET', '/health');
  console.log('health', health.status);

  console.log('\n=== Login (school_admin demo) ===');
  const login = await requestJson('POST', '/auth/school/login', {
    email: 'school_admin@demo.local',
    password: 'Sa3z&yU7!wE5sA2#cF6g',
  });
  if (login.status !== 200 && login.status !== 201) {
    console.error('Login failed', login.status, login.raw?.slice(0, 300));
    process.exit(1);
  }
  const token = login.json?.access_token || login.json?.token;
  if (!token) {
    console.error('Token yok', login.json);
    process.exit(1);
  }
  console.log('Login OK');

  console.log('\n=== upload-gpt-reconcile (deterministik, PREVIEW=0 ile kaydet) ===');
  const t0 = Date.now();
  const up = await uploadReconcile(token);
  console.log('status', up.status, 'süre', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if (up.json) {
    console.log('imported', up.json.imported, 'preview', up.json.preview, 'plan_id', up.json.plan_id);
    if (up.json.reconcile_stats) console.log('stats', up.json.reconcile_stats);
    console.log('errors', up.json.errors?.length ?? 0);
    if (up.json.errors?.length) console.log(up.json.errors.slice(0, 8));
  } else {
    console.log(up.raw?.slice(0, 500));
  }

  if (up.status === 200 || up.status === 201) {
    const planId = up.json?.plan_id;
    if (planId) {
      const plan = await requestJson('GET', `/teacher-timetable/plans/${planId}`, null, token);
      const n = plan.json?.entries?.length ?? 0;
      console.log('\nPlan entries:', n);
      if (plan.json?.entries?.[0]) console.log('örnek entry:', plan.json.entries[0]);
    }
  }

  process.exit(up.status === 200 || up.status === 201 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
