/**
 * Kelebek Sınav modülü – kapsamlı test verisi
 * Kullanım:
 *   node tools/seed-butterfly-exam.js [school_id] [--clean]
 *
 * --clean : Bu okul için mevcut butterfly verilerini siler, temiz başlar.
 */
require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');
const uid = () => crypto.randomUUID();

const client = new Client({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE || 'ogretmenpro',
});

/* ── Türkçe isim havuzu ── */
const MALE_NAMES = ['Ali', 'Ahmet', 'Mehmet', 'Mustafa', 'Hüseyin', 'İbrahim', 'Emre',
  'Burak', 'Yusuf', 'Furkan', 'Kaan', 'Arda', 'Onur', 'Sercan', 'Oğuzhan', 'Berk', 'Kerem'];
const FEMALE_NAMES = ['Ayşe', 'Fatma', 'Zeynep', 'Elif', 'Hatice', 'Merve', 'Büşra',
  'Selin', 'Derya', 'Cansu', 'Esra', 'Ebru', 'Neslihan', 'Simge', 'Dilara', 'İrem', 'Yağmur'];
const SURNAMES = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Arslan', 'Öztürk', 'Koç',
  'Aydın', 'Doğan', 'Yıldız', 'Çetin', 'Şimşek', 'Kılıç', 'Öz', 'Acar', 'Güneş',
  'Keskin', 'Erdoğan', 'Polat', 'Bozkurt', 'Doğru', 'Taş', 'Güler', 'Yalçın'];
const randomName = (i) => {
  const isM = i % 2 === 0;
  const first = isM ? MALE_NAMES[i % MALE_NAMES.length] : FEMALE_NAMES[i % FEMALE_NAMES.length];
  const last = SURNAMES[Math.floor(i * 17 + 3) % SURNAMES.length];
  return `${first} ${last}`;
};

/* ── Tarih yardımcıları ── */
const dt = (y, m, d, h = 9, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

async function run() {
  await client.connect();

  const args = process.argv.slice(2);
  const doClean = args.includes('--clean');
  const schoolArg = args.find((a) => !a.startsWith('--'));

  /* ── 1. Okul ── */
  let sid;
  if (schoolArg) {
    const r = await client.query('SELECT id, name FROM schools WHERE id = $1', [schoolArg]);
    if (!r.rows.length) { console.error('Okul bulunamadı:', schoolArg); process.exit(1); }
    sid = r.rows[0].id;
    console.log('Okul:', r.rows[0].name);
  } else {
    const r = await client.query("SELECT id, name FROM schools ORDER BY created_at LIMIT 1");
    if (!r.rows.length) { console.error('Hiç okul yok.'); process.exit(1); }
    sid = r.rows[0].id;
    console.log('Okul:', r.rows[0].name, '(' + sid + ')');
  }

  /* ── Temizleme ── */
  if (doClean) {
    console.log('\n⚠  --clean: Mevcut butterfly verileri siliniyor...');
    await client.query('DELETE FROM butterfly_seat_assignments WHERE plan_id IN (SELECT id FROM butterfly_exam_plans WHERE school_id = $1)', [sid]);
    await client.query('DELETE FROM butterfly_exam_proctors WHERE plan_id IN (SELECT id FROM butterfly_exam_plans WHERE school_id = $1)', [sid]);
    await client.query('DELETE FROM butterfly_exam_plans WHERE school_id = $1', [sid]);
    await client.query('DELETE FROM butterfly_rooms WHERE school_id = $1', [sid]);
    await client.query('DELETE FROM butterfly_buildings WHERE school_id = $1', [sid]);
    console.log('   Temizlendi.');
  }

  /* ── 2. Sınıflar (9-A … 12-C, toplam 12 şube) ── */
  const classDefs = [
    { label: '9-A',  grade: 9,  section: 'A' },
    { label: '9-B',  grade: 9,  section: 'B' },
    { label: '9-C',  grade: 9,  section: 'C' },
    { label: '10-A', grade: 10, section: 'A' },
    { label: '10-B', grade: 10, section: 'B' },
    { label: '10-C', grade: 10, section: 'C' },
    { label: '11-A', grade: 11, section: 'A' },
    { label: '11-B', grade: 11, section: 'B' },
    { label: '11-C', grade: 11, section: 'C' },
    { label: '12-A', grade: 12, section: 'A' },
    { label: '12-B', grade: 12, section: 'B' },
    { label: '12-C', grade: 12, section: 'C' },
  ];
  const classMap = {};
  console.log('\n── Sınıflar ──');
  for (const c of classDefs) {
    const ex = await client.query("SELECT id FROM school_classes WHERE school_id = $1 AND name = $2", [sid, c.label]);
    if (ex.rows.length) {
      classMap[c.label] = ex.rows[0].id;
      process.stdout.write('  (mevcut) ' + c.label + '\n');
    } else {
      const id = uid();
      await client.query(
        "INSERT INTO school_classes (id, school_id, name, grade, section, created_at) VALUES ($1,$2,$3,$4,$5,NOW())",
        [id, sid, c.label, c.grade, c.section]
      );
      classMap[c.label] = id;
      process.stdout.write('  + ' + c.label + '\n');
    }
  }

  /* ── 3. Öğrenciler (sınıf başına 28 öğrenci) ── */
  console.log('\n── Öğrenciler ──');
  let studentTotal = 0;
  for (const c of classDefs) {
    const cid = classMap[c.label];
    const ex = await client.query('SELECT COUNT(*) FROM students WHERE class_id = $1', [cid]);
    if (parseInt(ex.rows[0].count) >= 20) {
      process.stdout.write('  (mevcut) ' + c.label + '\n'); continue;
    }
    const gradeNo = c.grade * 100;
    for (let i = 0; i < 28; i++) {
      const name = randomName(studentTotal + i);
      const no = `${gradeNo + classDefs.filter(x => x.grade === c.grade).indexOf(c) * 100 + i + 1}`;
      await client.query(
        "INSERT INTO students (id, school_id, class_id, name, student_number, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())",
        [uid(), sid, cid, name, no]
      );
    }
    studentTotal += 28;
    process.stdout.write(`  + ${c.label}: 28 öğrenci\n`);
  }
  console.log('  Toplam yeni öğrenci:', studentTotal);

  /* ── 4. Binalar & Salonlar ── */
  console.log('\n── Bina & Salon ──');
  const buildingDefs = [
    { name: 'A Blok', rooms: [
      { name: 'A-101', capacity: 32, layout: JSON.stringify([{rowType:'pair',rowCount:8},{rowType:'single',rowCount:0}]) },
      { name: 'A-102', capacity: 32, layout: JSON.stringify([{rowType:'pair',rowCount:8}]) },
      { name: 'A-201', capacity: 24, layout: JSON.stringify([{rowType:'pair',rowCount:6},{rowType:'single',rowCount:0}]) },
      { name: 'A-202', capacity: 24, layout: JSON.stringify([{rowType:'pair',rowCount:6}]) },
      { name: 'A-301', capacity: 20, layout: JSON.stringify([{rowType:'pair',rowCount:5}]) },
    ]},
    { name: 'B Blok', rooms: [
      { name: 'B-101', capacity: 36, layout: JSON.stringify([{rowType:'pair',rowCount:9}]) },
      { name: 'B-102', capacity: 36, layout: JSON.stringify([{rowType:'pair',rowCount:9}]) },
      { name: 'B-103', capacity: 30, layout: JSON.stringify([{rowType:'pair',rowCount:7},{rowType:'single',rowCount:2}]) },
    ]},
    { name: 'Spor Salonu', rooms: [
      { name: 'SP-01', capacity: 80, layout: JSON.stringify([{rowType:'pair',rowCount:20}]) },
    ]},
  ];

  const allRooms = [];
  for (const [bi, bDef] of buildingDefs.entries()) {
    const ex = await client.query("SELECT id FROM butterfly_buildings WHERE school_id = $1 AND name = $2", [sid, bDef.name]);
    let bid;
    if (ex.rows.length) {
      bid = ex.rows[0].id;
      process.stdout.write('  (mevcut) ' + bDef.name + '\n');
    } else {
      bid = uid();
      await client.query(
        "INSERT INTO butterfly_buildings (id, school_id, name, sort_order, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())",
        [bid, sid, bDef.name, bi]
      );
      process.stdout.write('  + Bina: ' + bDef.name + '\n');
    }
    for (const [ri, rDef] of bDef.rooms.entries()) {
      const rex = await client.query("SELECT id FROM butterfly_rooms WHERE building_id = $1 AND name = $2", [bid, rDef.name]);
      let rid;
      if (rex.rows.length) {
        rid = rex.rows[0].id;
      } else {
        rid = uid();
        await client.query(
          "INSERT INTO butterfly_rooms (id, school_id, building_id, name, capacity, seat_layout, sort_order, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())",
          [rid, sid, bid, rDef.name, rDef.capacity, rDef.layout, ri]
        );
        process.stdout.write(`    + Salon: ${rDef.name} (${rDef.capacity} koltuk)\n`);
      }
      allRooms.push({ id: rid, name: rDef.name, capacity: rDef.capacity, buildingId: bid });
    }
  }

  const roomIds = allRooms.map((r) => r.id);

  /* ── 5. Ortak kurallar ── */
  const commonFooter = [
    'Her dersten bir dönemde iki ortak sınav yapılacaktır.',
    'Uygulamalı sınavlar, ders öğretmenleri tarafından uygun gün ve saatte yapılacaktır.',
    'Sınav süresi 40 olup sınav süresince öğrenci sınıftan çıkarılamayacaktır.',
    'Öğrencilerin sınava telefon veya diğer bilişim araçları ile sınava katılması kesinlikle yasaktır.',
    'Sınava girmeyen öğrenci için puanı "G", kopya çeken öğrenciler için ise "K" olarak e-Okula giriş yapılacaktır.',
  ];
  const reportSettings = {
    cityLine: 'Erzurum Valiliği\nErzurum Çok Programlı Anadolu Lisesi Müdürlüğü',
    academicYear: '2025 - 2026 Eğitim - Öğretim Yılı',
    duzenleyenName: 'Ali Bak',
    duzenleyenTitle: 'Müdür Yardımcısı',
    onaylayanName: 'Ebubekir Coşkun',
    onaylayanTitle: 'Müdür',
  };

  const baseRules = {
    fillMode: 'balanced',
    genderRule: 'can_sit_adjacent',
    classMix: 'cannot_mix',
    sameClassAdjacent: 'forbid',
    sameClassSkipOne: 'forbid',
    distributionMode: 'constraint_greedy',
    studentSortOrder: 'student_number',
    fillDirection: 'ltr',
    proctorMode: 'auto',
    proctorsPerRoom: 2,
    reportFooterLines: commonFooter,
    roomIds,
    ...reportSettings,
  };

  /* ── 6. Dönem Planı ── */
  console.log('\n── Sınav Planları ──');
  const periodTitle = 'I. Dönem I. Ortak Sınav';
  const exPeriod = await client.query(
    "SELECT id FROM butterfly_exam_plans WHERE school_id = $1 AND title = $2 LIMIT 1", [sid, periodTitle]
  );
  let periodPlanId;
  if (exPeriod.rows.length) {
    periodPlanId = exPeriod.rows[0].id;
    console.log('  (mevcut) Dönem planı:', periodTitle);
  } else {
    periodPlanId = uid();
    await client.query(
      "INSERT INTO butterfly_exam_plans (id, school_id, title, description, status, rules, exam_starts_at, created_at, updated_at) VALUES ($1,$2,$3,$4,'draft',$5,$6,NOW(),NOW())",
      [periodPlanId, sid, periodTitle, '2025-2026 Eğitim Öğretim Yılı I. Dönem',
        JSON.stringify({ planType: 'period', ...baseRules, reportFooterLines: commonFooter }),
        dt(2025, 12, 1)]
    );
    console.log('  + Dönem planı:', periodTitle);
  }

  /* ── 7. Bireysel sınav planları ── */
  const allClassIds = classDefs.map((c) => classMap[c.label]);
  const grade9Ids  = classDefs.filter((c) => c.grade === 9).map((c) => classMap[c.label]);
  const grade10Ids = classDefs.filter((c) => c.grade === 10).map((c) => classMap[c.label]);
  const grade11Ids = classDefs.filter((c) => c.grade === 11).map((c) => classMap[c.label]);
  const grade12Ids = classDefs.filter((c) => c.grade === 12).map((c) => classMap[c.label]);
  const grade910Ids = [...grade9Ids, ...grade10Ids];
  const grade1112Ids = [...grade11Ids, ...grade12Ids];

  const examDefs = [
    /* Pazartesi 1.12.2025 – 5. Ders */
    {
      title: 'Matematik (Tüm Sınıflar)',
      subject: 'MATEMATİK',
      date: dt(2025, 12, 1, 11, 30),
      period: '5. Ders',
      classLabels: classDefs.map((c) => c.label),
      aciklama: 'MEB Ortak Sınav',
    },
    /* Salı 2.12.2025 – 3. Ders */
    {
      title: 'Felsefe (10. ve 12. Sınıflar)',
      subject: 'FELSEFE',
      date: dt(2025, 12, 2, 9, 45),
      period: '3. Ders',
      classLabels: ['10-A','10-B','10-C','12-A','12-B','12-C'],
    },
    {
      title: 'Psikoloji (10. ve 12. Sınıflar)',
      subject: 'PSİKOLOJİ',
      date: dt(2025, 12, 2, 9, 45),
      period: '3. Ders',
      classLabels: ['10-A','10-B','10-C','12-A','12-B','12-C'],
    },
    {
      title: 'Türk Dili ve Edebiyatı (9. Sınıflar)',
      subject: 'TÜRK DİLİ VE EDEBİYATI',
      date: dt(2025, 12, 2, 9, 45),
      period: '3. Ders',
      classLabels: ['9-A','9-B','9-C'],
    },
    /* Çarşamba 3.12.2025 – 2. Ders */
    {
      title: 'Fizik (11. Sınıflar)',
      subject: 'FİZİK',
      date: dt(2025, 12, 3, 8, 55),
      period: '2. Ders',
      classLabels: ['11-A','11-B','11-C'],
    },
    {
      title: 'Kimya (11. Sınıflar)',
      subject: 'KİMYA',
      date: dt(2025, 12, 3, 8, 55),
      period: '2. Ders',
      classLabels: ['11-A','11-B','11-C'],
    },
    {
      title: 'Biyoloji (12. Sınıflar)',
      subject: 'BİYOLOJİ',
      date: dt(2025, 12, 3, 8, 55),
      period: '2. Ders',
      classLabels: ['12-A','12-B','12-C'],
    },
    /* Perşembe 4.12.2025 – 4. Ders */
    {
      title: 'Tarih (Tüm Sınıflar)',
      subject: 'TARİH',
      date: dt(2025, 12, 4, 10, 40),
      period: '4. Ders',
      classLabels: classDefs.map((c) => c.label),
    },
    {
      title: 'İngilizce (9. ve 10. Sınıflar)',
      subject: 'İNGİLİZCE',
      date: dt(2025, 12, 4, 10, 40),
      period: '4. Ders',
      classLabels: ['9-A','9-B','9-C','10-A','10-B','10-C'],
    },
  ];

  for (const exam of examDefs) {
    const ex = await client.query(
      "SELECT id FROM butterfly_exam_plans WHERE school_id = $1 AND title = $2 LIMIT 1", [sid, exam.title]
    );
    if (ex.rows.length) {
      console.log('  (mevcut)', exam.title);
      continue;
    }
    const participantClassIds = exam.classLabels.map((l) => classMap[l]).filter(Boolean);
    const classSubjectAssignments = exam.classLabels
      .map((l) => ({ classId: classMap[l], subjectName: exam.subject }))
      .filter((a) => a.classId);

    const rules = JSON.stringify({
      ...baseRules,
      planType: 'exam',
      parentPlanId: periodPlanId,
      subjectLabel: exam.subject,
      lessonPeriodLabel: exam.period,
      participantMode: 'classes',
      participantClassIds,
      classSubjectAssignments,
      ...(exam.aciklama ? { examNote: exam.aciklama } : {}),
    });

    await client.query(
      "INSERT INTO butterfly_exam_plans (id, school_id, title, status, rules, exam_starts_at, created_at, updated_at) VALUES ($1,$2,$3,'draft',$4,$5,NOW(),NOW())",
      [uid(), sid, exam.title, rules, exam.date]
    );
    console.log(`  + ${exam.title} (${exam.classLabels.length} şube, ${new Date(exam.date).toLocaleDateString('tr-TR')} ${exam.period})`);
  }

  await client.end();
  console.log('\n✅ Seed tamamlandı!');
  console.log('   Okul ID  :', sid);
  console.log('   Sınıflar :', classDefs.map((c) => c.label).join(', '));
  console.log('   Binalar  : A Blok (5 salon), B Blok (3 salon), Spor Salonu (1 salon)');
  console.log('   Sınavlar :', examDefs.length, '(+ 1 dönem planı)');
}

run().catch((e) => { console.error(e); client.end().catch(() => {}); process.exit(1); });
