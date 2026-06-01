/**
 * Demo okul DersDağıt kurulumu (çalışan API gerekir: localhost:4000).
 * node tools/seed-ders-dagit-demo.cjs
 * node tools/seed-ders-dagit-demo.cjs --no-generate
 */
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = (process.env.SEED_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = 'school_admin@demo.local';
const ADMIN_PASS = 'Sa3z&yU7!wE5sA2#cF6g';
const SECTIONS = ['9/A'];
const KEEP_TEACHER_EMAILS = ['teacher@demo.local'];
const DEMO_SCHOOL_NAMES = ['Ankara Çankaya Demo Lisesi', 'Demo Okulu'];

const noGenerate = process.argv.includes('--no-generate');

function pgClient() {
  return new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
}

async function pgClearStudioCatalog(studioId) {
  const client = pgClient();
  await client.connect();
  await client.query(
    `DELETE FROM ders_dagit_assignment_teacher WHERE assignment_id IN (SELECT id FROM ders_dagit_assignment WHERE studio_id = $1)`,
    [studioId],
  );
  const a = await client.query(`DELETE FROM ders_dagit_assignment WHERE studio_id = $1`, [studioId]);
  const s = await client.query(`DELETE FROM ders_dagit_subject WHERE studio_id = $1`, [studioId]);
  console.log('Katalog temiz:', a.rowCount, 'atama,', s.rowCount, 'ders');
  await client.end();
}

async function pgStudioCleanup(studioId, schoolId) {
  const client = pgClient();
  await client.connect();
  const emails = KEEP_TEACHER_EMAILS.map((e) => e.toLowerCase());
  const del = await client.query(
    `DELETE FROM ders_dagit_teacher_config t
     WHERE t.studio_id = $1
       AND t.user_id NOT IN (SELECT id FROM users WHERE lower(trim(email)) = ANY($2::text[]))`,
    [studioId, emails],
  );
  console.log('Stüdyo öğretmen temizlik:', del.rowCount);
  await client.query(
    `UPDATE ders_dagit_teacher_config
     SET mandatory_weekly_hours = NULL, max_extra_weekly_hours = 80, max_lessons_per_day = 8
     WHERE studio_id = $1`,
    [studioId],
  );
  const arch = await client.query(
    `UPDATE duty_plan SET archived_at = NOW()
     WHERE school_id = $1 AND archived_at IS NULL`,
    [schoolId],
  );
  console.log('Nöbet arşiv:', arch.rowCount);
  await client.end();
}

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
    const msg = typeof data === 'object' ? JSON.stringify(data, null, 2) : text;
    throw new Error(`${method} ${p} → ${res.status}\n${msg}`);
  }
  return data;
}

async function login() {
  const res = await fetch(`${BASE}/auth/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS, remember_me: true }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) throw new Error('Giriş başarısız: ' + JSON.stringify(data));
  return data.token;
}

function roomFor(rooms, section) {
  const s = section.toLocaleLowerCase('tr');
  const hit = rooms.find((r) => {
    const a = r.allowed_class_sections || [];
    if (a.some((x) => String(x).toLocaleLowerCase('tr') === s)) return true;
    return String(r.name).trim().toLocaleLowerCase('tr') === s;
  });
  return hit?.id;
}

function pickTeacher(ids, load, hours) {
  let best = ids[0];
  let bestL = Infinity;
  for (const t of ids) {
    const l = load.get(t) || 0;
    if (l < bestL) {
      bestL = l;
      best = t;
    }
  }
  load.set(best, (load.get(best) || 0) + hours);
  return best;
}

(async () => {
  const token = await login();
  console.log('Giriş OK');

  const studios = await api(token, 'GET', '/ders-dagit/studios');
  let studio = studios?.[0];
  if (!studio) {
    studio = await api(token, 'POST', '/ders-dagit/studios', {});
  }
  const sid = studio.id;
  console.log('Stüdyo:', sid);

  const schoolId = studio.school_id;
  await api(token, 'PATCH', `/ders-dagit/studios/${sid}/school-profile`, { type: 'anadolu_lise' });
  await api(token, 'PATCH', `/ders-dagit/studios/${sid}/periods`, {
    period: {
      work_days: [1, 2, 3, 4, 5],
      lessons_per_day_by_dow: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 },
      long_breaks: [{ after_lesson: 4, label: 'Öğle', blocked_slots: 1 }],
    },
    dual_education: { enabled: false },
  });

  const profiles = await api(token, 'GET', `/ders-dagit/studios/${sid}/class-profiles`);
  for (const p of profiles || []) {
    await api(token, 'DELETE', `/ders-dagit/studios/${sid}/class-profiles/${p.id}`);
  }
  await api(token, 'POST', `/ders-dagit/studios/${sid}/class-profiles`, {
    name: '9. Sınıf (demo)',
    class_sections: SECTIONS,
    max_lessons_per_day: 18,
  });

  await api(token, 'POST', `/ders-dagit/studios/${sid}/teachers/sync`);
  await api(token, 'POST', `/ders-dagit/studios/${sid}/sync-extra-lesson-params`);
  if (schoolId) await pgStudioCleanup(sid, schoolId);
  await pgClearStudioCatalog(sid);

  const MIN_SUBJECTS = [
    { name: 'Matematik', short_code: 'mat', class_hours: { '9/A': 5 } },
    { name: 'Türk Dili ve Edebiyatı', short_code: 'tur', class_hours: { '9/A': 5 } },
    { name: 'Fizik', short_code: 'fiz', class_hours: { '9/A': 2 } },
    { name: 'Kimya', short_code: 'kim', class_hours: { '9/A': 2 } },
    { name: 'Biyoloji', short_code: 'bio', class_hours: { '9/A': 2 } },
    { name: 'Tarih', short_code: 'tar', class_hours: { '9/A': 2 } },
    { name: 'Coğrafya', short_code: 'cog', class_hours: { '9/A': 2 } },
    { name: 'İngilizce', short_code: 'ing', class_hours: { '9/A': 4 } },
    { name: 'Din Kültürü', short_code: 'din', class_hours: { '9/A': 2 } },
    { name: 'Beden Eğitimi', short_code: 'bed', class_hours: { '9/A': 2 } },
  ];
  for (const sub of MIN_SUBJECTS) {
    await api(token, 'POST', `/ders-dagit/studios/${sid}/subjects`, sub);
  }
  const sync = await api(token, 'POST', `/ders-dagit/studios/${sid}/assignments/sync-from-subjects`, {
    replace: true,
  });
  console.log('Ders kataloğu:', MIN_SUBJECTS.length, '→ atama', sync.created ?? sync.updated ?? '');

  const roomsRes = await api(token, 'POST', '/ders-dagit/rooms/auto-from-sections', { studio_id: sid });
  console.log('Derslik +', roomsRes.created);

  const [assignments, rooms, teachers] = await Promise.all([
    api(token, 'GET', `/ders-dagit/studios/${sid}/assignments`),
    api(token, 'GET', '/ders-dagit/rooms'),
    api(token, 'GET', `/ders-dagit/studios/${sid}/teachers`),
  ]);
  const tIds = (teachers || []).map((t) => t.user_id);
  const load = new Map();
  console.log('Atama:', (assignments || []).length, 'Öğretmen:', tIds.length);
  const rows = [];
  for (const a of assignments || []) {
    const sec = a.class_sections?.[0];
    const hrs = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
    const tid = pickTeacher(tIds, load, hrs);
    const rid = sec ? roomFor(rooms, sec) : null;
    rows.push({
      id: a.id,
      subject_name: a.subject_name,
      class_sections: a.class_sections,
      weekly_hours: a.weekly_hours,
      teacher_ids: [tid],
      room_ids: rid ? [rid] : [],
    });
  }
  await api(token, 'PATCH', `/ders-dagit/studios/${sid}/assignments/bulk`, { rows });

  const val = await api(token, 'GET', `/ders-dagit/studios/${sid}/validation`);
  const errs = (val || []).filter((i) => i.severity === 'error');
  if (errs.length) {
    console.error('Doğrulama:', errs);
    process.exit(1);
  }

  if (noGenerate) {
    console.log('Kurulum tamam (--no-generate)');
    return;
  }

  const gen = await api(token, 'POST', `/ders-dagit/studios/${sid}/generate`, {
    duration_sec: 120,
    versions: 1,
    use_csp: false,
  });
  const prog = gen.programs?.[0];
  console.log('Program:', prog?.id, 'skor=', gen.score ?? prog?.score);
  console.log('Web: http://localhost:3000/ → Ders Dağıt');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
