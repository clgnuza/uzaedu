import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { SiteMapItem } from '../site-map/entities/site-map-item.entity';
import { AcademicCalendarItem } from '../academic-calendar/entities/academic-calendar-item.entity';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { BilsemService } from '../bilsem/bilsem.service';
import { generateMebWorkCalendar } from '../config/meb-calendar';
import {
  ACADEMIC_CALENDAR_2025_2026,
  BELIRLI_ALLOWED,
  BELIRLI_NORMALIZE,
  OGRETMEN_PATH,
} from '../academic-calendar/academic-calendar.seed';
import { ACADEMIC_CALENDAR_TYPE_EXTRAS_2025_2026 } from '../academic-calendar/academic-calendar.seed-by-type';
import { UserRole, UserStatus } from '../types/enums';
import { SchoolStatus, SchoolType, SchoolSegment } from '../types/enums';
import { DEMO_CREDENTIALS } from './demo-credentials';

/** Defterdoldur tarzı akademik takvim yapısı (site_map_item seed). */
const AKADEMIK_TAKVIM_SEED: Array<{ title: string; path: string | null; description: string | null; sortOrder: number; children?: Array<{ title: string; path: string | null; description: string | null; sortOrder: number }> }> = [
  { title: 'Ana Sayfa', path: '/dashboard', description: 'Ana sayfaya dön', sortOrder: 0 },
  {
    title: 'Yıllık Planlar',
    path: null,
    description: 'Yıllık plan işlemleri',
    sortOrder: 1,
    children: [
      { title: 'Planlarım', path: '/evrak', description: 'Favori planlarınız', sortOrder: 0 },
      { title: 'Kayıtlı Planlarım', path: '/evrak', description: 'Kayıtlı planlarınız', sortOrder: 1 },
      { title: 'Kazanım Ara', path: '/evrak', description: 'Kazanım arama', sortOrder: 2 },
      { title: 'BEP Programı', path: '/evrak', description: 'BEP programı yönetimi', sortOrder: 3 },
      { title: 'Tüm Branşlar', path: '/evrak', description: 'Tüm branş planları', sortOrder: 4 },
      { title: 'Sınıf Seviyeleri', path: '/evrak', description: 'Sınıflara göre planlar', sortOrder: 5 },
    ],
  },
  {
    title: 'Günlük Planlar',
    path: null,
    description: 'Günlük plan işlemleri',
    sortOrder: 2,
    children: [
      { title: 'Günlük Plan Oluştur', path: '/evrak', description: 'Yeni günlük plan oluştur', sortOrder: 0 },
      { title: 'Günlük Planlar', path: '/evrak', description: 'Günlük planlarınız', sortOrder: 1 },
    ],
  },
  {
    title: 'Sınavlar',
    path: null,
    description: 'Sınav işlemleri',
    sortOrder: 3,
    children: [
      { title: 'Sınav Hazırla', path: '/evrak', description: 'Yeni sınav hazırla', sortOrder: 0 },
      { title: 'Soru Üret', path: '/evrak', description: 'Soru bankası', sortOrder: 1 },
      { title: 'Sınav Analizleri', path: '/evrak', description: 'Sınav analiz raporları', sortOrder: 2 },
      { title: 'Performans Değerlendir', path: '/evrak', description: 'Performans değerlendirme', sortOrder: 3 },
    ],
  },
  {
    title: 'Sınıf Yönetimi',
    path: null,
    description: 'Sınıf yönetim araçları',
    sortOrder: 4,
    children: [
      { title: 'Sınıf Yönetimi', path: '/classes-subjects', description: 'Sınıf yönetim araçları', sortOrder: 0 },
      { title: 'Süreç Formları', path: '/classes-subjects', description: 'Süreç değerlendirme formları', sortOrder: 1 },
      { title: 'Sınıflarım', path: '/classes-subjects', description: 'Sınıf ve öğrenci listeleri', sortOrder: 2 },
      { title: 'Kazanım Değerlendirme', path: '/kazanim-takip', description: 'Ders başarısını ölçeklendirin', sortOrder: 3 },
      { title: 'Aylık Ders Raporu', path: '/kazanim-takip', description: 'Aylık rapor oluşturma', sortOrder: 4 },
    ],
  },
  {
    title: 'Öğretmen Ağı',
    path: null,
    description: 'Öğretmen paylaşımları',
    sortOrder: 5,
    children: [
      { title: 'Akış', path: '/dashboard', description: 'Öğretmen paylaşımları', sortOrder: 0 },
      { title: 'Sayfam', path: '/profile', description: 'Profil sayfanız', sortOrder: 1 },
      { title: 'Okul Görev Sistemi', path: '/duty', description: 'Okul görev yönetimi', sortOrder: 2 },
      { title: 'Topluluk', path: '/haberler', description: 'Öğretmen topluluğu', sortOrder: 3 },
      { title: 'MEB Haberler/Duyurular', path: '/haberler', description: 'MEB haberleri ve duyurular', sortOrder: 4 },
      { title: 'Okullar', path: '/dashboard', description: 'Okul bilgileri', sortOrder: 5 },
      { title: 'Haftalık Bülten', path: '/haberler', description: 'Haftalık bülten', sortOrder: 6 },
      { title: 'Akademik Takvim', path: '/akademik-takvim', description: 'Akademik takvim', sortOrder: 7 },
      { title: 'Okul Yönetim', path: '/dashboard', description: 'Okul yönetim bilgileri', sortOrder: 8 },
      { title: 'Blog', path: '/haberler', description: 'Eğitim makaleleri', sortOrder: 9 },
    ],
  },
  {
    title: 'Araçlar',
    path: null,
    description: 'Yardımcı araçlar',
    sortOrder: 6,
    children: [
      { title: 'Ders Programı', path: '/ders-programi', description: 'Ders programı yönetimi', sortOrder: 0 },
      { title: 'Akademik Planlayıcı', path: '/akademik-takvim', description: 'Yıllık plan ve takvim', sortOrder: 1 },
      { title: 'Notlarım', path: '/dashboard', description: 'Kişisel notlarınız', sortOrder: 2 },
      { title: 'Zümre Tutanakları', path: '/evrak', description: 'Zümre toplantı tutanakları', sortOrder: 3 },
      { title: 'Veli Toplantıları', path: '/evrak', description: 'Veli toplantı yönetimi', sortOrder: 4 },
      { title: 'Web 2.0 Araçları', path: '/dashboard', description: 'Web 2.0 eğitim araçları', sortOrder: 5 },
      { title: 'Sınıf İçi Araçlar', path: '/dashboard', description: 'Sınıf içi etkinlik araçları', sortOrder: 6 },
      { title: 'Proje Asistanı', path: '/evrak', description: 'Proje yönetim asistanı', sortOrder: 7 },
      { title: 'Dosya ve Evraklar', path: '/evrak', description: 'Dosya ve evrak yönetimi', sortOrder: 8 },
      { title: 'ŞÖK Tutanakları', path: '/dashboard', description: 'ŞÖK toplantı tutanakları', sortOrder: 9 },
      { title: 'Kulüp Planları', path: '/evrak', description: 'Sosyal kulüp planları', sortOrder: 10 },
      { title: 'Şeflik Planları', path: '/evrak', description: 'Şeflik planları', sortOrder: 11 },
      { title: 'Metin Editörü', path: '/dashboard', description: 'Metin düzenleme aracı', sortOrder: 12 },
      { title: 'Eğitici Oyunlar', path: '/dashboard', description: 'Eğitici oyunlar', sortOrder: 13 },
      { title: 'İletişim', path: '/dashboard', description: 'Bize ulaşın', sortOrder: 14 },
    ],
  },
  {
    title: 'Özel Eğitim',
    path: null,
    description: 'Özel eğitim araçları',
    sortOrder: 7,
    children: [
      { title: 'BEP Programı', path: '/evrak', description: 'BEP programı yönetimi', sortOrder: 0 },
    ],
  },
];

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(SiteMapItem)
    private readonly siteMapRepo: Repository<SiteMapItem>,
    @InjectRepository(AcademicCalendarItem)
    private readonly acItemRepo: Repository<AcademicCalendarItem>,
    private readonly workCalendarService: WorkCalendarService,
    private readonly bilsemService: BilsemService,
  ) {}

  async run(): Promise<{ schoolId: string; userId: string; message: string }> {
    const [hashTeacher, hashSchoolAdmin, hashSuperadmin] = await Promise.all([
      bcrypt.hash(DEMO_CREDENTIALS.teacher.password, 10),
      bcrypt.hash(DEMO_CREDENTIALS.school_admin.password, 10),
      bcrypt.hash(DEMO_CREDENTIALS.superadmin.password, 10),
    ]);
    const existing = await this.userRepo.count();

    await this.seedSiteMap();
    await this.seedAcademicCalendar();
    await this.seedBilsemCalendar('2025-2026');

    if (existing > 0) {
      // Mevcut veritabanı: demo hesaplara şifre ata veya school_admin oluştur
      const superadmin = await this.userRepo.findOne({
        where: { email: 'superadmin@demo.local' },
      });
      if (superadmin) {
        superadmin.passwordHash = hashSuperadmin;
        if (!superadmin.emailVerifiedAt) superadmin.emailVerifiedAt = new Date();
        await this.userRepo.save(superadmin);
      }
      let school = await this.schoolRepo.findOne({ where: {} });
      const demoSchoolData = {
        name: 'Demo Okulu',
        type: SchoolType.lise,
        segment: SchoolSegment.devlet,
        city: 'Ankara',
        district: 'Çankaya',
        status: SchoolStatus.aktif,
        teacher_limit: 100,
        website_url: 'https://demookulu.meb.k12.tr',
        phone: '0312 555 00 00',
        fax: '0312 555 11 22',
        institutionCode: '123456',
        institutionalEmail: 'info@demookulu.meb.k12.tr',
        address: 'Kızılay Mah. Atatürk Bulvarı No:1 Çankaya/ANKARA',
        mapUrl: 'https://www.google.com/maps/place/Ankara',
        schoolImageUrl: 'https://picsum.photos/400/201',
        about_description:
          'Demo Okulu test verileriyle doldurulmuştur. Atatürk ilke ve inkılâplarına bağlı, geleceğe yön veren örnek bir eğitim kurumudur.',
        principalName: 'Demo Müdür',
        enabled_modules: ['butterfly_exam', 'sorumluluk_sinav', 'messaging', 'teacher_agenda', 'duty', 'bilsem', 'optical', 'smart_board', 'tv', 'school_reviews', 'document', 'outcome'],
      };
      if (!school) {
        school = await this.schoolRepo.save(this.schoolRepo.create(demoSchoolData));
      } else {
        Object.assign(school, demoSchoolData);
        await this.schoolRepo.save(school);
      }
      const schoolAdminExists = await this.userRepo.findOne({
        where: { email: 'school_admin@demo.local' },
      });
      if (!schoolAdminExists) {
        await this.userRepo.save(
          this.userRepo.create({
            email: 'school_admin@demo.local',
            display_name: 'Okul Admin',
            role: UserRole.school_admin,
            school_id: school.id,
            status: UserStatus.active,
            firebaseUid: null,
            passwordHash: hashSchoolAdmin,
            emailVerifiedAt: new Date(),
          }),
        );
      } else {
        schoolAdminExists.passwordHash = hashSchoolAdmin;
        if (!schoolAdminExists.emailVerifiedAt) schoolAdminExists.emailVerifiedAt = new Date();
        await this.userRepo.save(schoolAdminExists);
      }
      const teacherExists = await this.userRepo.findOne({
        where: { email: 'teacher@demo.local' },
      });
      if (!teacherExists) {
        await this.userRepo.save(
          this.userRepo.create({
            email: 'teacher@demo.local',
            display_name: 'Test Öğretmen',
            role: UserRole.teacher,
            school_id: school.id,
            status: UserStatus.active,
            firebaseUid: null,
            passwordHash: hashTeacher,
            emailVerifiedAt: new Date(),
          }),
        );
      } else {
        teacherExists.passwordHash = hashTeacher;
        if (!teacherExists.emailVerifiedAt) teacherExists.emailVerifiedAt = new Date();
        await this.userRepo.save(teacherExists);
      }
      const first = await this.userRepo.findOne({ where: {}, order: { created_at: 'ASC' } });
      return {
        schoolId: first?.school_id || school.id,
        userId: first?.id || '',
        message:
          'Demo hesaplar güncellendi. Şifreler web-admin giriş sayfasındaki yerel demo listesi ile aynıdır.',
      };
    }

    const school = this.schoolRepo.create({
      name: 'Demo Okulu',
      type: SchoolType.lise,
      segment: SchoolSegment.devlet,
      city: 'Ankara',
      district: 'Çankaya',
      status: SchoolStatus.aktif,
      teacher_limit: 100,
      enabled_modules: ['butterfly_exam', 'sorumluluk_sinav', 'messaging', 'teacher_agenda', 'duty', 'bilsem', 'optical', 'smart_board', 'tv', 'school_reviews', 'document', 'outcome'],
    });
    const savedSchool = await this.schoolRepo.save(school);

    const superadmin = this.userRepo.create({
      email: 'superadmin@demo.local',
      display_name: 'Süper Admin',
      role: UserRole.superadmin,
      school_id: null,
      status: UserStatus.active,
      firebaseUid: null,
      passwordHash: hashSuperadmin,
      emailVerifiedAt: new Date(),
    });
    await this.userRepo.save(superadmin);

    const schoolAdmin = this.userRepo.create({
      email: 'school_admin@demo.local',
      display_name: 'Okul Admin',
      role: UserRole.school_admin,
      school_id: savedSchool.id,
      status: UserStatus.active,
      firebaseUid: null,
      passwordHash: hashSchoolAdmin,
      emailVerifiedAt: new Date(),
    });
    await this.userRepo.save(schoolAdmin);

    const teacher = this.userRepo.create({
      email: 'teacher@demo.local',
      display_name: 'Test Öğretmen',
      role: UserRole.teacher,
      school_id: savedSchool.id,
      status: UserStatus.active,
      firebaseUid: null,
      passwordHash: hashTeacher,
      emailVerifiedAt: new Date(),
    });
    await this.userRepo.save(teacher);

    return {
      schoolId: savedSchool.id,
      userId: superadmin.id,
      message:
        'Demo hesaplar oluşturuldu. Şifreler web-admin giriş sayfasındaki yerel demo listesi ile aynıdır.',
    };
  }

  /** Akademik takvim (site_map_item) Defterdoldur tarzı seed */
  private async seedSiteMap(): Promise<void> {
    const count = await this.siteMapRepo.count();
    if (count > 0) return;
    for (const root of AKADEMIK_TAKVIM_SEED) {
      const parent = this.siteMapRepo.create({
        parentId: null,
        title: root.title,
        path: root.path,
        description: root.description,
        sortOrder: root.sortOrder,
        isActive: true,
      });
      const saved = await this.siteMapRepo.save(parent);
      if (root.children) {
        for (const child of root.children) {
          const c = this.siteMapRepo.create({
            parentId: saved.id,
            title: child.title,
            path: child.path,
            description: child.description,
            sortOrder: child.sortOrder,
            isActive: true,
          });
          await this.siteMapRepo.save(c);
        }
      }
    }
  }

  /** Akademik takvim öğeleri – work_calendar (eğitim öğretim takvimi) ile eşleşir. */
  private async seedAcademicCalendar(): Promise<void> {
    await this.seedAcademicCalendarOnly('2025-2026');
  }

  /** Sadece akademik takvim şablonu – work_calendar ile eşleştirip günceller (silmeden, mevcut içerik korunur). */
  async seedAcademicCalendarOnly(year: string): Promise<{ seeded: number }> {
    const targetYear = year && year.length >= 9 ? year : '2025-2026';
    let workWeeks = await this.workCalendarService.findAll(targetYear);
    if (workWeeks.length === 0) {
      const mebWeeks = generateMebWorkCalendar(targetYear);
      workWeeks = await this.workCalendarService.bulkCreate(
        targetYear,
        mebWeeks.map((w) => ({
          week_order: w.week_order,
          week_start: w.week_start,
          week_end: w.week_end,
          ay: w.ay,
          hafta_label: w.hafta_label,
          is_tatil: w.is_tatil,
          tatil_label: w.tatil_label,
          sinav_etiketleri: w.sinav_etiketleri,
        })),
      );
    }
    const weekIds = workWeeks.map((w) => w.id);
    if (weekIds.length === 0) return { seeded: 0 };

    const scopeKey = (st: SchoolType[] | null | undefined) =>
      st?.length ? JSON.stringify([...st].sort()) : '';
    const itemLookupKey = (itemType: string, title: string, schoolTypes: SchoolType[] | null | undefined) =>
      `${itemType}|${title}|${scopeKey(schoolTypes)}`;

    const toDateKey = (d: string | Date) =>
      typeof d === 'string' ? d.slice(0, 10) : (d as Date).toISOString().slice(0, 10);
    const seedData = targetYear === '2025-2026' ? ACADEMIC_CALENDAR_2025_2026 : [];
    const seedByDate = new Map<string, (typeof ACADEMIC_CALENDAR_2025_2026)[0]>();
    for (const row of seedData) {
      seedByDate.set(`${row.start}|${row.end}`, row);
    }

    let seeded = 0;
    let existingByWeek = await this.acItemRepo.find({ where: { weekId: In(weekIds) } });
    let byWeek = new Map<string, AcademicCalendarItem[]>();
    for (const i of existingByWeek) {
      const list = byWeek.get(i.weekId) ?? [];
      list.push(i);
      byWeek.set(i.weekId, list);
    }

    for (const wc of workWeeks) {
      const key = `${toDateKey(wc.weekStart)}|${toDateKey(wc.weekEnd)}`;
      const row = seedByDate.get(key);
      if (!row) continue;

      const existing = byWeek.get(wc.id) ?? [];
      const existingByKey = new Map<string, AcademicCalendarItem>();
      for (const e of existing) {
        existingByKey.set(itemLookupKey(e.itemType, e.title, e.schoolTypes ?? null), e);
      }

      const belirliFiltered = row.belirli
        .map((t) => BELIRLI_NORMALIZE[t] ?? t)
        .filter((t) => BELIRLI_ALLOWED.has(t));
      const ogretmenFiltered = row.ogretmen.filter((t) => t in OGRETMEN_PATH);

      let so = 0;
      for (const t of belirliFiltered) {
        const k = itemLookupKey('belirli_gun_hafta', t, null);
        const found = existingByKey.get(k);
        if (found) {
          found.sortOrder = so;
          found.schoolTypes = null;
          await this.acItemRepo.save(found);
        } else {
          const item = this.acItemRepo.create({
            weekId: wc.id,
            itemType: 'belirli_gun_hafta',
            title: t,
            path: null,
            sortOrder: so,
            isActive: true,
            schoolTypes: null,
          });
          await this.acItemRepo.save(item);
          seeded++;
        }
        so++;
      }
      for (const t of ogretmenFiltered) {
        const path = OGRETMEN_PATH[t] ?? '/evrak';
        const k = itemLookupKey('ogretmen_isleri', t, null);
        const found = existingByKey.get(k);
        if (found) {
          found.sortOrder = so;
          found.path = path;
          found.schoolTypes = null;
          await this.acItemRepo.save(found);
        } else {
          const item = this.acItemRepo.create({
            weekId: wc.id,
            itemType: 'ogretmen_isleri',
            title: t,
            path,
            sortOrder: so,
            isActive: true,
            schoolTypes: null,
          });
          await this.acItemRepo.save(item);
          seeded++;
        }
        so++;
      }
    }

    existingByWeek = await this.acItemRepo.find({ where: { weekId: In(weekIds) } });
    byWeek = new Map<string, AcademicCalendarItem[]>();
    for (const i of existingByWeek) {
      const list = byWeek.get(i.weekId) ?? [];
      list.push(i);
      byWeek.set(i.weekId, list);
    }

    for (const schoolType of Object.values(SchoolType)) {
      const extrasList = ACADEMIC_CALENDAR_TYPE_EXTRAS_2025_2026[schoolType];
      if (!extrasList?.length) continue;

      for (const wc of workWeeks) {
        const dk = `${toDateKey(wc.weekStart)}|${toDateKey(wc.weekEnd)}`;
        const row = seedByDate.get(dk);
        if (!row) continue;
        const extra = extrasList.find((e) => e.w === row.w);
        if (!extra) continue;

        const existing = byWeek.get(wc.id) ?? [];
        const existingByKey = new Map<string, AcademicCalendarItem>();
        for (const e of existing) {
          existingByKey.set(itemLookupKey(e.itemType, e.title, e.schoolTypes ?? null), e);
        }

        const belirliFiltered = extra.belirli
          .map((t) => BELIRLI_NORMALIZE[t] ?? t)
          .filter((t) => BELIRLI_ALLOWED.has(t));
        const ogretmenFiltered = extra.ogretmen.filter((t) => t in OGRETMEN_PATH);

        let so =
          existing.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1;
        const stArr = [schoolType];

        for (const t of belirliFiltered) {
          const lk = itemLookupKey('belirli_gun_hafta', t, stArr);
          const found = existingByKey.get(lk);
          if (found) {
            found.sortOrder = so;
            await this.acItemRepo.save(found);
          } else {
            const item = this.acItemRepo.create({
              weekId: wc.id,
              itemType: 'belirli_gun_hafta',
              title: t,
              path: null,
              sortOrder: so,
              isActive: true,
              schoolTypes: stArr,
            });
            await this.acItemRepo.save(item);
            existing.push(item);
            existingByKey.set(lk, item);
            seeded++;
          }
          so++;
        }
        for (const t of ogretmenFiltered) {
          const path = OGRETMEN_PATH[t] ?? '/evrak';
          const lk = itemLookupKey('ogretmen_isleri', t, stArr);
          const found = existingByKey.get(lk);
          if (found) {
            found.sortOrder = so;
            found.path = path;
            await this.acItemRepo.save(found);
          } else {
            const item = this.acItemRepo.create({
              weekId: wc.id,
              itemType: 'ogretmen_isleri',
              title: t,
              path,
              sortOrder: so,
              isActive: true,
              schoolTypes: stArr,
            });
            await this.acItemRepo.save(item);
            existing.push(item);
            existingByKey.set(lk, item);
            seeded++;
          }
          so++;
        }
        byWeek.set(wc.id, existing);
      }
    }

    const total = await this.acItemRepo.count({ where: { weekId: In(weekIds) } });
    return { seeded: total };
  }

  async seedBilsemCalendar(academicYear: string): Promise<{ seeded: number }> {
    return this.bilsemService.seedBilsemCalendar(academicYear);
  }
}
