/**
 * Mevcut ders + öğretmen kataloğunu koruyarak demo stüdyoyu program üretimine hazırlar.
 * node tools/fill-ders-dagit-demo.cjs
 * node tools/fill-ders-dagit-demo.cjs --no-generate
 */
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = (process.env.SEED_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = 'school_admin@demo.local';
const ADMIN_PASS = 'Sa3z&yU7!wE5sA2#cF6g';
const noGenerate = process.argv.includes('--no-generate');

/** Ders adı → öğretmen adında aranacak parçalar (yoksa tüm öğretmen havuzu) */
const SUBJECT_NAME_KEYS = [
  ['matemat', ['matemat']],
  ['geometri', ['matemat']],
  ['türk', ['türk', 'edebiyat']],
  ['edebiyat', ['türk', 'edebiyat']],
  ['fizik', ['fizik']],
  ['kimya', ['kimya']],
  ['biyoloji', ['biyoloji', 'biyol']],
  ['beslenme', ['biyoloji', 'beslen']],
  ['enfeksiyon', ['biyoloji', 'sağlık']],
  ['sistem hast', ['biyoloji', 'sağlık']],
  ['sağlık', ['sağlık', 'hemşire']],
  ['ilaç', ['kimya', 'eczac']],
  ['yabancı', ['ingiliz', 'yabancı', 'english']],
  ['ingiliz', ['ingiliz', 'yabancı']],
  ['tarih', ['tarih', 'inkılâp', 'inkilap']],
  ['inkılâp', ['tarih', 'inkılâp']],
  ['coğrafya', ['coğrafya']],
  ['din ', ['din ', 'ilahiyat']],
  ['ahlak', ['din ', 'ilahiyat']],
  ['peygamber', ['din ']],
  ['beden', ['beden', 'spor']],
  ['spor', ['beden', 'spor']],
  ['müzik', ['müzik', 'sanat']],
  ['görsel', ['görsel', 'resim', 'sanat']],
  ['rehberlik', ['rehber', 'pdr', 'rehberlik']],
  ['mesleki', ['meslek', 'işletme', 'uygulama']],
  ['uygulama', ['meslek', 'uygulama']],
  ['ilk yardım', ['sağlık', 'hemşire']],
  ['aseptik', ['sağlık', 'hemşire']],
];

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

function pgClient() {
  return new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
}

/** 208 satırlık bulk API zaman aşımına düşer; öğretmen/derslik bağlantısını doğrudan yazar */
async function enableDemoRelaxStrict(studioId) {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `UPDATE ders_dagit_studio
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [studioId, JSON.stringify({ demo_relax_strict_rules: true })],
    );
  } finally {
    await client.end();
  }
}

async function removeNonTeachingTeachersFromStudio(studioId) {
  const client = pgClient();
  await client.connect();
  try {
    const del = await client.query(
      `DELETE FROM ders_dagit_teacher_config t
       WHERE t.studio_id = $1
         AND t.user_id IN (
           SELECT id FROM users
           WHERE lower(trim(email)) LIKE '%admin%'
              OR lower(coalesce(display_name, '')) LIKE '%admin%'
         )`,
      [studioId],
    );
    return del.rowCount;
  } finally {
    await client.end();
  }
}

async function applyAssignmentsPg(studioId, rows) {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM ders_dagit_assignment_teacher
       WHERE assignment_id IN (SELECT id FROM ders_dagit_assignment WHERE studio_id = $1)`,
      [studioId],
    );
    for (const row of rows) {
      const tid = row.teacher_ids?.[0];
      if (tid) {
        await client.query(
          `INSERT INTO ders_dagit_assignment_teacher (assignment_id, user_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [row.id, tid],
        );
      }
      if (row.room_ids?.length) {
        await client.query(`UPDATE ders_dagit_assignment SET room_ids = $2::jsonb WHERE id = $1`, [
          row.id,
          JSON.stringify(row.room_ids),
        ]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
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

function teacherPoolForSubject(subjectName, teachers) {
  const sn = subjectName.toLocaleLowerCase('tr');
  for (const [subKey, nameKeys] of SUBJECT_NAME_KEYS) {
    if (!sn.includes(subKey)) continue;
    const pool = teachers.filter((t) => {
      const n = (t.display_name ?? '').toLocaleLowerCase('tr');
      return nameKeys.some((k) => n.includes(k));
    });
    if (pool.length) return pool.map((t) => t.user_id);
  }
  return teachers.map((t) => t.user_id);
}

const TEACHER_WEEKLY_MAX = 65;

function isTeachingTeacher(t) {
  const n = (t.display_name ?? '').toLocaleLowerCase('tr');
  const e = (t.email ?? '').toLocaleLowerCase('tr');
  return !n.includes('admin') && !e.includes('admin@') && !e.includes('school_admin');
}

function pickTeacher(pool, load, hours) {
  const eligible = pool.filter((id) => (load.get(id) || 0) + hours <= TEACHER_WEEKLY_MAX);
  const use = eligible.length ? eligible : pool;
  let best = use[0];
  let bestL = Infinity;
  for (const id of use) {
    const l = load.get(id) || 0;
    if (l < bestL) {
      bestL = l;
      best = id;
    }
  }
  load.set(best, (load.get(best) || 0) + hours);
  return best;
}

function collectSections(subjects, assignments, profiles) {
  const set = new Set();
  for (const p of profiles || []) {
    for (const s of p.class_sections ?? []) if (s?.trim()) set.add(s.trim());
  }
  for (const sub of subjects || []) {
    for (const k of Object.keys(sub.class_hours ?? {})) if (k?.trim()) set.add(k.trim());
  }
  for (const a of assignments || []) {
    for (const s of a.class_sections ?? []) if (s?.trim()) set.add(s.trim());
  }
  return [...set];
}

(async () => {
  const token = await login();
  console.log('Giriş OK');

  const studios = await api(token, 'GET', '/ders-dagit/studios');
  const studio = studios?.[0];
  if (!studio) throw new Error('Stüdyo yok');
  const sid = studio.id;
  console.log('Stüdyo:', sid);

  await api(token, 'PATCH', `/ders-dagit/studios/${sid}/school-profile`, { type: 'mtal' });
  await api(token, 'PATCH', `/ders-dagit/studios/${sid}/periods`, {
    period: {
      work_days: [1, 2, 3, 4, 5],
      lessons_per_day_by_dow: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9 },
      long_breaks: [{ after_lesson: 5, label: 'Öğle', blocked_slots: 1 }],
    },
    dual_education: { enabled: false },
  });

  const [subjects, assignments, teachers, profiles, roomsBefore] = await Promise.all([
    api(token, 'GET', `/ders-dagit/studios/${sid}/subjects`),
    api(token, 'GET', `/ders-dagit/studios/${sid}/assignments`),
    api(token, 'GET', `/ders-dagit/studios/${sid}/teachers`),
    api(token, 'GET', `/ders-dagit/studios/${sid}/class-profiles`),
    api(token, 'GET', '/ders-dagit/rooms'),
  ]);

  console.log('Mevcut:', subjects.length, 'ders,', teachers.length, 'öğretmen,', assignments.length, 'atama');

  await api(token, 'POST', `/ders-dagit/studios/${sid}/teachers/sync`);
  const removedAdmin = await removeNonTeachingTeachersFromStudio(sid);
  if (removedAdmin) console.log('Stüdyodan admin öğretmen kaydı kaldırıldı:', removedAdmin);
  await api(token, 'POST', `/ders-dagit/studios/${sid}/sync-extra-lesson-params`);

  const teachersAfterSync = await api(token, 'GET', `/ders-dagit/studios/${sid}/teachers`);
  for (const t of teachersAfterSync || []) {
    await api(token, 'POST', `/ders-dagit/studios/${sid}/teachers`, {
      id: t.id,
      user_id: t.user_id,
      mandatory_weekly_hours: 40,
      max_extra_weekly_hours: 30,
      max_lessons_per_day: 9,
    });
  }
  console.log('Öğretmen limitleri:', teachersAfterSync.filter(isTeachingTeacher).length, '× max 70 s/hf');

  const sections = collectSections(subjects, assignments, profiles);
  if (profiles?.length === 1) {
    const p = profiles[0];
    await api(token, 'POST', `/ders-dagit/studios/${sid}/class-profiles`, {
      id: p.id,
      name: p.name,
      class_sections: sections.length ? sections : p.class_sections,
      max_lessons_per_day: 9,
      max_weekly_lessons: 45,
    });
    console.log('Profil güncellendi:', sections.length, 'şube, max 9/gün');
  } else if (!profiles?.length && sections.length) {
    await api(token, 'POST', `/ders-dagit/studios/${sid}/class-profiles`, {
      name: 'Demo (otomatik)',
      class_sections: sections,
      max_lessons_per_day: 9,
      max_weekly_lessons: 45,
    });
    console.log('Profil oluşturuldu');
  }

  let rooms = roomsBefore;
  if (!rooms?.length) {
    const r = await api(token, 'POST', '/ders-dagit/rooms/auto-from-sections', { studio_id: sid });
    console.log('Derslik oluşturuldu:', r.created);
    rooms = await api(token, 'GET', '/ders-dagit/rooms');
  }

  const teachersFresh = (await api(token, 'GET', `/ders-dagit/studios/${sid}/teachers`)).filter(isTeachingTeacher);
  const allTeacherIds = teachersFresh.map((t) => t.user_id);
  if (allTeacherIds.length < 2) throw new Error('En az 2 öğretmen gerekli (admin hariç).');
  const load = new Map();
  let assignedTeachers = 0;
  let assignedRooms = 0;
  const sorted = [...(assignments || [])].sort(
    (a, b) =>
      (b.biweekly ? b.weekly_hours / 2 : b.weekly_hours) -
      (a.biweekly ? a.weekly_hours / 2 : a.weekly_hours),
  );
  const rows = [];
  for (const a of sorted) {
    const sec = a.class_sections?.[0];
    const hrs = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
    const hinted = teacherPoolForSubject(a.subject_name ?? '', teachersFresh);
    const hintedOk = hinted.filter((id) => (load.get(id) || 0) + hrs <= TEACHER_WEEKLY_MAX);
    const pickPool = hintedOk.length >= 2 ? hintedOk : allTeacherIds;
    assignedTeachers++;
    const teacher_ids = [pickTeacher(pickPool, load, hrs)];
    const rid = sec ? roomFor(rooms, sec) : null;
    const room_ids =
      (a.room_ids?.length ?? 0) > 0 ? a.room_ids : rid ? (assignedRooms++, [rid]) : [];
    rows.push({
      id: a.id,
      subject_name: a.subject_name,
      class_sections: a.class_sections,
      weekly_hours: a.weekly_hours,
      biweekly: a.biweekly,
      teacher_ids,
      room_ids,
    });
  }

  if (rows.length) {
    const peak = Math.max(...[...load.values()]);
    console.log('Yük dağılımı: en yoğun öğretmen', peak, 's/hf');
    await applyAssignmentsPg(sid, rows);
    console.log('Atama güncellendi (PG):', rows.length, '· öğretmen:', assignedTeachers, '· derslik:', assignedRooms);
  }

  const missingSubjects = (subjects || []).filter((s) => {
    const keys = Object.keys(s.class_hours ?? {});
    return !assignments.some((a) => a.subject_name === s.name || a.subject_id === s.id);
  });
  if (missingSubjects.length) {
    const sync = await api(token, 'POST', `/ders-dagit/studios/${sid}/assignments/sync-from-subjects`, {
      replace: false,
    });
    console.log('Eksik katalog atamaları:', sync.created ?? 0, 'yeni');
  }

  const val = await api(token, 'GET', `/ders-dagit/studios/${sid}/validation`);
  const errs = (val || []).filter((i) => i.severity === 'error');
  const warns = (val || []).filter((i) => i.severity === 'warning');
  console.log('Doğrulama:', errs.length, 'hata,', warns.length, 'uyarı');
  if (errs.length) {
    const codes = [...new Set(errs.map((e) => e.code))];
    console.log('Hata kodları:', codes.join(', '));
    console.log(errs.slice(0, 8));
    process.exit(1);
  }

  if (noGenerate) {
    console.log('Hazır (--no-generate). Web: http://localhost:3000/ders-dagit/studyo');
    return;
  }

  const rulesRes = await api(token, 'GET', `/ders-dagit/studios/${sid}/rules`);
  const nextRules = { ...(rulesRes.rules ?? {}) };
  for (const key of Object.keys(nextRules)) {
    nextRules[key] = { ...nextRules[key], active: false };
  }
  await api(token, 'PATCH', `/ders-dagit/studios/${sid}/rules`, { rules: nextRules });
  const profilesForRules = await api(token, 'GET', `/ders-dagit/studios/${sid}/class-profiles`);
  for (const p of profilesForRules || []) {
    await api(token, 'POST', `/ders-dagit/studios/${sid}/class-profiles`, {
      id: p.id,
      name: p.name,
      class_sections: p.class_sections,
      max_lessons_per_day: p.max_lessons_per_day,
      max_weekly_lessons: p.max_weekly_lessons ?? 45,
      rules: {},
    });
  }
  console.log('Demo üretim: stüdyo kuralları kapalı');
  await enableDemoRelaxStrict(sid);

  console.log('Program üretiliyor…');
  const gen = await api(token, 'POST', `/ders-dagit/studios/${sid}/generate`, {
    duration_sec: 180,
    versions: 2,
    use_csp: false,
  });
  const prog = gen.programs?.[0];
  console.log('Program:', prog?.id, 'skor=', gen.score ?? prog?.score);
  console.log('http://localhost:3000/ders-dagit/studyo');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
