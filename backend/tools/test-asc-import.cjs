/** aSc XML import test — node tools/test-asc-import.cjs [xmlPath] */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = (process.env.SEED_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'school_admin@demo.local';
const ADMIN_PASS = process.env.SEED_ADMIN_PASS || 'Sa3z&yU7!wE5sA2#cF6g';
const xmlPath = process.argv[2] || 'C:/Users/mehme/OneDrive/Desktop/bilsemasctest.xml';

async function api(token, method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${p} → ${res.status}\n${typeof data === 'object' ? JSON.stringify(data, null, 2) : text}`);
  }
  return data;
}

async function main() {
  const buf = fs.readFileSync(xmlPath);
  const b64 = buf.toString('base64');
  const login = await api(null, 'POST', '/auth/school/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    remember_me: true,
  });
  const token = login.token;
  const studios = await api(token, 'GET', '/ders-dagit/studios');
  const studio = studios?.[0];
  if (!studio) throw new Error('Stüdyo yok');
  const schoolId = studio.school_id;

  console.log('Preview…');
  const preview = await api(token, 'POST', `/ders-dagit/studios/${studio.id}/transfer/import/preview`, {
    format: 'asc_xml',
    file_base64: b64,
  });
  console.log({
    assignments: preview.row_count,
    asc_meta: preview.asc_meta,
    warnings: preview.warnings?.map((w) => w.message),
    unmatched: preview.rows?.filter((r) => r.match_warning).length,
  });

  console.log('Import (replace=true)…');
  const result = await api(token, 'POST', `/ders-dagit/studios/${studio.id}/transfer/import`, {
    format: 'asc_xml',
    file_base64: b64,
    replace: true,
  });
  console.log(result);

  const subjects = await api(token, 'GET', `/ders-dagit/studios/${studio.id}/subjects`);
  const assignments = await api(token, 'GET', `/ders-dagit/studios/${studio.id}/assignments`);
  const groups = await api(token, 'GET', `/ders-dagit/studios/${studio.id}/groups`);
  const rooms = await api(token, 'GET', '/ders-dagit/rooms');
  const withTeacher = assignments.filter((a) => (a.teacher_ids ?? []).length).length;
  const withRoom = assignments.filter((a) => (a.room_ids ?? []).length).length;
  const withGroup = assignments.filter((a) => a.group_id).length;

  console.log('DB özeti:', {
    subjects: subjects.length,
    assignments: assignments.length,
    withTeacher,
    withRoom,
    withGroup,
    groups: groups.length,
    rooms: rooms.length,
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
