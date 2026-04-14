/**
 * Kertenkele Sınav – Sıfırla + Tek Ders Full Test Verisi
 *
 * Kullanım:
 *   node tools/seed-butterfly-reset.js [school_id]
 *
 * Yaptıkları:
 *   1. Okuldaki TÜM butterfly verilerini siler (salonlar, planlar, atamalar, modül öğretmenleri)
 *   2. Okuldaki TÜM öğrenci ve sınıfları siler
 *   3. 9-A, 9-B, 9-C, 10-A, 10-B, 10-C (6 şube, 26'şar öğrenci) ekler
 *   4. 2 bina / 6 salon ekler
 *   5. 1 dönem planı + 1 tam dolu MAT sınavı planı ekler (Matematik, tüm sınıflar)
 *   6. Sınavı yerleştirir (seat_assignments oluşturur)
 *   7. Modül öğretmenlerini ekler (okuldaki ilk 3 öğretmen)
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

const MALE_NAMES   = ['Ali','Ahmet','Mehmet','Mustafa','Hüseyin','İbrahim','Emre','Burak','Yusuf','Furkan','Kaan','Arda','Onur','Sercan','Berk','Kerem','Uğur','Tolga'];
const FEMALE_NAMES = ['Ayşe','Fatma','Zeynep','Elif','Hatice','Merve','Büşra','Selin','Derya','Cansu','Esra','Ebru','Neslihan','Simge','Dilara','İrem','Yağmur','Gizem'];
const SURNAMES     = ['Yılmaz','Kaya','Demir','Şahin','Çelik','Arslan','Öztürk','Koç','Aydın','Doğan','Yıldız','Çetin','Şimşek','Kılıç','Öz','Acar','Güneş','Keskin','Polat','Bozkurt'];

const rnd = (arr, i) => arr[i % arr.length];
const randomName = (i) => {
  const isM = i % 2 === 0;
  return `${isM ? rnd(MALE_NAMES, i) : rnd(FEMALE_NAMES, i)} ${rnd(SURNAMES, Math.floor(i * 13 + 7) % SURNAMES.length)}`;
};

async function run() {
  await client.connect();

  const args    = process.argv.slice(2);
  const schoolArg = args.find((a) => !a.startsWith('--'));

  /* ── 1. Okul ── */
  let sid, schoolName;
  if (schoolArg) {
    const r = await client.query('SELECT id, name FROM schools WHERE id = $1', [schoolArg]);
    if (!r.rows.length) { console.error('Okul bulunamadı:', schoolArg); process.exit(1); }
    sid = r.rows[0].id; schoolName = r.rows[0].name;
  } else {
    const r = await client.query("SELECT id, name FROM schools ORDER BY created_at LIMIT 1");
    if (!r.rows.length) { console.error('Hiç okul yok.'); process.exit(1); }
    sid = r.rows[0].id; schoolName = r.rows[0].name;
  }
  console.log(`\n🏫 Okul: ${schoolName} (${sid})`);

  /* ── 2. Temizlik ── */
  console.log('\n🗑  Mevcut veriler siliniyor...');
  await client.query('DELETE FROM butterfly_seat_assignments WHERE plan_id IN (SELECT id FROM butterfly_exam_plans WHERE school_id = $1)', [sid]);
  await client.query('DELETE FROM butterfly_exam_proctors WHERE plan_id IN (SELECT id FROM butterfly_exam_plans WHERE school_id = $1)', [sid]);
  await client.query('DELETE FROM butterfly_exam_plans WHERE school_id = $1', [sid]);
  await client.query('DELETE FROM butterfly_rooms WHERE school_id = $1', [sid]);
  await client.query('DELETE FROM butterfly_buildings WHERE school_id = $1', [sid]);
  await client.query('DELETE FROM butterfly_module_teachers WHERE school_id = $1', [sid]);
  await client.query('DELETE FROM students WHERE school_id = $1', [sid]);
  await client.query('DELETE FROM school_classes WHERE school_id = $1', [sid]);
  console.log('   ✓ Temizlendi.');

  /* ── 3. Sınıflar ── */
  console.log('\n📚 Sınıflar oluşturuluyor...');
  const classDefs = [
    { label: '9-A',  grade: 9,  section: 'A' },
    { label: '9-B',  grade: 9,  section: 'B' },
    { label: '9-C',  grade: 9,  section: 'C' },
    { label: '10-A', grade: 10, section: 'A' },
    { label: '10-B', grade: 10, section: 'B' },
    { label: '10-C', grade: 10, section: 'C' },
  ];
  const classMap = {};
  for (const c of classDefs) {
    const id = uid();
    await client.query(
      'INSERT INTO school_classes (id, school_id, name, grade, section, created_at) VALUES ($1,$2,$3,$4,$5,NOW())',
      [id, sid, c.label, c.grade, c.section]
    );
    classMap[c.label] = id;
    console.log(`   + ${c.label}`);
  }

  /* ── 4. Öğrenciler (sınıf başı 26) ── */
  console.log('\n👨‍🎓 Öğrenciler ekleniyor...');
  const STUDENTS_PER_CLASS = 26;
  const allStudentIds = {};
  let globalIdx = 0;
  for (const c of classDefs) {
    const cid = classMap[c.label];
    allStudentIds[c.label] = [];
    for (let i = 0; i < STUDENTS_PER_CLASS; i++) {
      const id   = uid();
      const name = randomName(globalIdx++);
      const no   = `${c.grade}${classDefs.filter(x => x.grade === c.grade).indexOf(c) + 1}${String(i + 1).padStart(2, '0')}`;
      await client.query(
        'INSERT INTO students (id, school_id, class_id, name, student_number, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())',
        [id, sid, cid, name, no]
      );
      allStudentIds[c.label].push(id);
    }
    console.log(`   + ${c.label}: ${STUDENTS_PER_CLASS} öğrenci`);
  }
  const totalStudents = classDefs.length * STUDENTS_PER_CLASS;
  console.log(`   Toplam: ${totalStudents} öğrenci`);

  /* ── 5. Binalar & Salonlar ── */
  console.log('\n🏢 Binalar & Salonlar oluşturuluyor...');
  const buildingDefs = [
    {
      name: 'A Blok',
      rooms: [
        { name: 'A-101', capacity: 32, layout: JSON.stringify([{rowType:'pair',rowCount:8},{rowType:'single',rowCount:0}]) },
        { name: 'A-102', capacity: 28, layout: JSON.stringify([{rowType:'pair',rowCount:7}]) },
        { name: 'A-201', capacity: 24, layout: JSON.stringify([{rowType:'pair',rowCount:6}]) },
      ],
    },
    {
      name: 'B Blok',
      rooms: [
        { name: 'B-101', capacity: 36, layout: JSON.stringify([{rowType:'pair',rowCount:9}]) },
        { name: 'B-102', capacity: 32, layout: JSON.stringify([{rowType:'pair',rowCount:8}]) },
        { name: 'B-201', capacity: 24, layout: JSON.stringify([{rowType:'pair',rowCount:6}]) },
      ],
    },
  ];

  const allRooms = [];
  for (const [bi, bDef] of buildingDefs.entries()) {
    const bid = uid();
    await client.query(
      'INSERT INTO butterfly_buildings (id, school_id, name, sort_order, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())',
      [bid, sid, bDef.name, bi]
    );
    console.log(`   + Bina: ${bDef.name}`);
    for (const [ri, rDef] of bDef.rooms.entries()) {
      const rid = uid();
      await client.query(
        'INSERT INTO butterfly_rooms (id, school_id, building_id, name, capacity, seat_layout, sort_order, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())',
        [rid, sid, bid, rDef.name, rDef.capacity, rDef.layout, ri]
      );
      allRooms.push({ id: rid, name: rDef.name, capacity: rDef.capacity, buildingId: bid, buildingName: bDef.name });
      console.log(`      + Salon: ${rDef.name} (${rDef.capacity} koltuk)`);
    }
  }

  /* ── 6. Sınav Planları ── */
  console.log('\n📋 Sınav planları oluşturuluyor...');

  const reportSettings = {
    cityLine: 'Erzurum Valiliği\nErzurum Çok Programlı Anadolu Lisesi Müdürlüğü',
    academicYear: '2025 - 2026 Eğitim - Öğretim Yılı',
    duzenleyenName: 'Ali Bak',
    duzenleyenTitle: 'Müdür Yardımcısı',
    onaylayanName: 'Ebubekir Coşkun',
    onaylayanTitle: 'Müdür',
  };

  const commonFooter = [
    'Her dersten bir dönemde iki ortak sınav yapılacaktır.',
    'Uygulamalı sınavlar, ders öğretmenleri tarafından uygun gün ve saatte yapılacaktır.',
    'Sınav süresi 40 dakika olup süre boyunca öğrenci sınıftan çıkarılamaz.',
    'Öğrencilerin sınava telefon veya diğer bilişim araçları ile girmesi kesinlikle yasaktır.',
    'Sınava girmeyen öğrenci için "G", kopya çeken için "K" olarak e-Okula giriş yapılacaktır.',
  ];

  const roomIds = allRooms.map((r) => r.id);
  const allClassIds = classDefs.map((c) => classMap[c.label]);

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

  // Dönem Planı
  const periodId = uid();
  const periodTitle = 'I. Dönem I. Ortak Sınav';
  await client.query(
    "INSERT INTO butterfly_exam_plans (id, school_id, title, description, status, rules, exam_starts_at, created_at, updated_at) VALUES ($1,$2,$3,$4,'draft',$5,$6,NOW(),NOW())",
    [periodId, sid, periodTitle, '2025-2026 Eğitim Öğretim Yılı I. Dönem I. Ortak Sınav',
      JSON.stringify({ planType: 'period', ...baseRules }),
      new Date(2025, 11, 1).toISOString()]
  );
  console.log(`   + Dönem planı: ${periodTitle}`);

  // MAT Sınav Planı (tek, tüm sınıflar)
  const classSubjectAssignments = classDefs.map((c) => ({
    classId: classMap[c.label],
    subjectName: 'MATEMATİK',
    className: c.label,
  }));

  const matId = uid();
  const matTitle = 'Matematik (Tüm Sınıflar)';
  const matRules = {
    ...baseRules,
    planType: 'exam',
    parentPlanId: periodId,
    subjectLabel: 'MATEMATİK',
    lessonPeriodLabel: '5. Ders',
    participantMode: 'classes',
    participantClassIds: allClassIds,
    classSubjectAssignments,
    examNote: 'MEB Ortak Sınav',
    examPaperConfig: {
      pageCount: 4,
      usedPageCount: 4,
      showQrCode: true,
      qrCorner: 'tr',
      fields: [],
    },
  };

  const matDate = new Date(2025, 11, 1, 11, 30).toISOString();
  await client.query(
    "INSERT INTO butterfly_exam_plans (id, school_id, title, status, rules, exam_starts_at, created_at, updated_at) VALUES ($1,$2,$3,'draft',$4,$5,NOW(),NOW())",
    [matId, sid, matTitle, JSON.stringify(matRules), matDate]
  );
  console.log(`   + Sınav planı: ${matTitle}`);

  /* ── 7. Yerleştirme (Seat Assignments) ── */
  console.log('\n🪑 Öğrenciler salonlara yerleştiriliyor...');

  // Tüm öğrencileri topla, student_number sırasına göre sırala
  const allStudentsFlat = [];
  for (const c of classDefs) {
    const cid = classMap[c.label];
    const rows = await client.query(
      'SELECT id, student_number FROM students WHERE class_id = $1 ORDER BY student_number', [cid]
    );
    for (const row of rows.rows) {
      allStudentsFlat.push({ studentId: row.id, classId: cid });
    }
  }

  // Salonları kapasitelerine göre sıralı dağıt
  let seatCursor = 0;
  for (const room of allRooms) {
    const roomStudents = allStudentsFlat.slice(seatCursor, seatCursor + room.capacity);
    if (roomStudents.length === 0) break;

    for (let si = 0; si < roomStudents.length; si++) {
      const s = roomStudents[si];
      await client.query(
        'INSERT INTO butterfly_seat_assignments (id, plan_id, student_id, room_id, seat_index, locked, is_manual, created_at) VALUES ($1,$2,$3,$4,$5,false,false,NOW())',
        [uid(), matId, s.studentId, room.id, si]
      );
    }
    seatCursor += roomStudents.length;
    console.log(`   + ${room.buildingName}/${room.name}: ${roomStudents.length} öğrenci`);
    if (seatCursor >= allStudentsFlat.length) break;
  }
  console.log(`   Toplam yerleştirilen: ${Math.min(seatCursor, totalStudents)} / ${totalStudents}`);

  // Sınav planını 'published' yap
  await client.query("UPDATE butterfly_exam_plans SET status = 'published' WHERE id = $1", [matId]);
  console.log('   ✓ Sınav durumu: published');

  /* ── 8. Modül Öğretmenleri ── */
  console.log('\n👩‍🏫 Modül öğretmenleri ekleniyor...');
  const teacherRows = await client.query(
    "SELECT id, display_name, email FROM users WHERE school_id = $1 AND role = 'teacher' ORDER BY created_at LIMIT 5",
    [sid]
  );
  if (teacherRows.rows.length) {
    for (const t of teacherRows.rows) {
      await client.query(
        'INSERT INTO butterfly_module_teachers (id, school_id, user_id, created_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT DO NOTHING',
        [uid(), sid, t.id]
      );
      console.log(`   + ${t.display_name ?? t.email}`);
    }
  } else {
    console.log('   (okula kayıtlı öğretmen bulunamadı)');
  }

  /* ── 9. Gözetmen Atamaları ── */
  if (teacherRows.rows.length >= 2) {
    console.log('\n🧑‍💼 Gözetmen atamaları yapılıyor...');
    const teachers = teacherRows.rows;
    for (let ri = 0; ri < allRooms.length; ri++) {
      const room = allRooms[ri];
      const t1 = teachers[ri % teachers.length];
      const t2 = teachers[(ri + 1) % teachers.length];
      for (const [si, t] of [[0, t1], [1, t2]]) {
        if (t1.id === t2.id && si === 1) continue;
        await client.query(
          'INSERT INTO butterfly_exam_proctors (id, plan_id, room_id, user_id, label, sort_order, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())',
          [uid(), matId, room.id, t.id, null, si]
        );
      }
      console.log(`   + ${room.buildingName}/${room.name}: ${t1.display_name ?? t1.email}${t1.id !== t2.id ? ', ' + (t2.display_name ?? t2.email) : ''}`);
    }
  }

  /* ── 10. Ders (Subject) ── */
  console.log('\n📖 Ders ekleniyor...');
  const exSub = await client.query(
    "SELECT id FROM subjects WHERE school_id = $1 AND name = 'MATEMATİK' LIMIT 1", [sid]
  ).catch(() => ({ rows: [] }));
  if (!exSub.rows.length) {
    // classes-subjects modülünden subject ekle
    const subCheck = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='subjects' AND column_name='school_id' LIMIT 1"
    ).catch(() => ({ rows: [] }));
    if (subCheck.rows.length) {
      await client.query(
        "INSERT INTO subjects (id, school_id, name, created_at, updated_at) VALUES ($1,$2,'MATEMATİK',NOW(),NOW()) ON CONFLICT DO NOTHING",
        [uid(), sid]
      ).catch(() => null);
      console.log('   + MATEMATİK dersi eklendi');
    } else {
      console.log('   (subjects tablosu farklı yapıda, atlandı)');
    }
  } else {
    console.log('   (MATEMATİK zaten mevcut)');
  }

  await client.end();

  console.log('\n✅ Seed tamamlandı!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Okul          :', schoolName);
  console.log('  Sınıflar      :', classDefs.map((c) => c.label).join(', '));
  console.log('  Öğrenci       :', totalStudents, `(${STUDENTS_PER_CLASS} × 6 şube)`);
  console.log('  Binalar       : A Blok (3 salon), B Blok (3 salon)');
  console.log('  Salonlar      :', allRooms.map((r) => r.name).join(', '));
  console.log('  Dönem Planı   :', periodTitle);
  console.log('  Sınav Planı   :', matTitle, '→ published + yerleştirildi');
  console.log('  Modül Öğrt.   :', teacherRows.rows.length);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

run().catch((e) => { console.error('\n❌ Hata:', e.message); client.end().catch(() => {}); process.exit(1); });
