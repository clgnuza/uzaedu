import { Injectable, Logger } from '@nestjs/common';
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
import { DtSchoolProcurementSettings } from '../dogrudan-temin/entities/dt-school-procurement-settings.entity';
import { DtVendor } from '../dogrudan-temin/entities/dt-vendor.entity';
import { DtFile } from '../dogrudan-temin/entities/dt-file.entity';
import { DtItem } from '../dogrudan-temin/entities/dt-item.entity';
import { DtFileDocumentRegistry } from '../dogrudan-temin/entities/dt-file-document-registry.entity';
import { DtAcceptanceCommission } from '../dogrudan-temin/entities/dt-acceptance-commission.entity';
import { DtAcceptanceCommissionMember } from '../dogrudan-temin/entities/dt-acceptance-commission-member.entity';
import { DtQuote } from '../dogrudan-temin/entities/dt-quote.entity';
import { DtQuoteItem } from '../dogrudan-temin/entities/dt-quote-item.entity';
import { DtAward } from '../dogrudan-temin/entities/dt-award.entity';
import { DtBudgetAccount } from '../dogrudan-temin/entities/dt-budget-account.entity';
import { DtBudgetBlock } from '../dogrudan-temin/entities/dt-budget-block.entity';
import { DtPayment } from '../dogrudan-temin/entities/dt-payment.entity';
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
import { DEMO_SCHOOL_DISPLAY_NAME, DEMO_SCHOOL_NAMES_FOR_QUERY } from './demo-school.constants';

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
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(SiteMapItem)
    private readonly siteMapRepo: Repository<SiteMapItem>,
    @InjectRepository(AcademicCalendarItem)
    private readonly acItemRepo: Repository<AcademicCalendarItem>,
    @InjectRepository(DtSchoolProcurementSettings)
    private readonly dtSettingsRepo: Repository<DtSchoolProcurementSettings>,
    @InjectRepository(DtVendor)
    private readonly dtVendorRepo: Repository<DtVendor>,
    @InjectRepository(DtFile)
    private readonly dtFileRepo: Repository<DtFile>,
    @InjectRepository(DtItem)
    private readonly dtItemRepo: Repository<DtItem>,
    @InjectRepository(DtFileDocumentRegistry)
    private readonly dtRegistryRepo: Repository<DtFileDocumentRegistry>,
    @InjectRepository(DtAcceptanceCommission)
    private readonly dtCommissionRepo: Repository<DtAcceptanceCommission>,
    @InjectRepository(DtAcceptanceCommissionMember)
    private readonly dtCommissionMemberRepo: Repository<DtAcceptanceCommissionMember>,
    @InjectRepository(DtQuote)
    private readonly dtQuoteRepo: Repository<DtQuote>,
    @InjectRepository(DtQuoteItem)
    private readonly dtQuoteItemRepo: Repository<DtQuoteItem>,
    @InjectRepository(DtAward)
    private readonly dtAwardRepo: Repository<DtAward>,
    @InjectRepository(DtBudgetAccount)
    private readonly dtBudgetAccountRepo: Repository<DtBudgetAccount>,
    @InjectRepository(DtBudgetBlock)
    private readonly dtBudgetBlockRepo: Repository<DtBudgetBlock>,
    @InjectRepository(DtPayment)
    private readonly dtPaymentRepo: Repository<DtPayment>,
    private readonly workCalendarService: WorkCalendarService,
    private readonly bilsemService: BilsemService,
  ) {}

  /** Yerel seed: demo öğretmen / okul admin hangi okuldaysa o kanonik Demo okuludur. */
  private async resolveCanonicalDemoSchool(): Promise<School | null> {
    const teacher = await this.userRepo.findOne({ where: { email: 'teacher@demo.local' } });
    if (teacher?.school_id) {
      const s = await this.schoolRepo.findOne({ where: { id: teacher.school_id } });
      if (s) return s;
    }
    const admin = await this.userRepo.findOne({ where: { email: 'school_admin@demo.local' } });
    if (admin?.school_id) {
      const s = await this.schoolRepo.findOne({ where: { id: admin.school_id } });
      if (s) return s;
    }
    const byCode = await this.schoolRepo.findOne({
      where: { institutionCode: '123456' },
      order: { created_at: 'ASC' },
    });
    if (byCode) return byCode;
    return this.schoolRepo.findOne({
      where: { name: In([...DEMO_SCHOOL_NAMES_FOR_QUERY]) },
      order: { created_at: 'ASC' },
    });
  }

  /** Aynı adda ikinci Demo okulu; kullanıcısı yoksa sil (FK engellerse atlanır). */
  private async removeEmptyDuplicateDemoSchools(canonicalId: string): Promise<void> {
    const rows = await this.schoolRepo.find({
      where: { name: In([...DEMO_SCHOOL_NAMES_FOR_QUERY]) },
      order: { created_at: 'ASC' },
    });
    for (const row of rows) {
      if (row.id === canonicalId) continue;
      const n = await this.userRepo.count({ where: { school_id: row.id } });
      if (n > 0) continue;
      try {
        await this.schoolRepo.remove(row);
        this.logger.log(`Yinelenen boş demo okul silindi: ${row.id}`);
      } catch (e) {
        this.logger.warn(`Boş demo okul silinemedi (${row.id}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

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
      let school = await this.resolveCanonicalDemoSchool();
      const demoSchoolData = {
        name: DEMO_SCHOOL_DISPLAY_NAME,
        type: SchoolType.lise,
        segment: SchoolSegment.devlet,
        city: 'Ankara',
        district: 'Çankaya',
        status: SchoolStatus.aktif,
        teacher_limit: 100,
        website_url: 'https://demo.example.edu',
        phone: '0312 555 00 00',
        fax: '0312 555 11 22',
        institutionCode: '123456',
        institutionalEmail: 'bilgi@demo.example.edu',
        address: 'Demo Mah. Örnek Cad. No:1 Çankaya / Ankara',
        mapUrl: 'https://www.openstreetmap.org/',
        schoolImageUrl: 'https://picsum.photos/400/201',
        about_description:
          'Yerel geliştirme için örnek okul kaydıdır; gerçek kurum veya kişi adı içermez.',
        principalName: 'Demo Müdür',
        enabled_modules: ['butterfly_exam', 'sorumluluk_sinav', 'messaging', 'teacher_agenda', 'duty', 'bilsem', 'optical', 'smart_board', 'tv', 'school_reviews', 'document', 'outcome', 'ders_dagit'],
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
        schoolAdminExists.school_id = school.id;
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
        teacherExists.school_id = school.id;
        if (!teacherExists.emailVerifiedAt) teacherExists.emailVerifiedAt = new Date();
        await this.userRepo.save(teacherExists);
      }
      await this.removeEmptyDuplicateDemoSchools(school.id);
      const first = await this.userRepo.findOne({ where: {}, order: { created_at: 'ASC' } });
      return {
        schoolId: first?.school_id || school.id,
        userId: first?.id || '',
        message:
          'Demo hesaplar güncellendi. Şifreler web-admin giriş sayfasındaki yerel demo listesi ile aynıdır.',
      };
    }

    const school = this.schoolRepo.create({
      name: DEMO_SCHOOL_DISPLAY_NAME,
      type: SchoolType.lise,
      segment: SchoolSegment.devlet,
      city: 'Ankara',
      district: 'Çankaya',
      status: SchoolStatus.aktif,
      teacher_limit: 100,
      enabled_modules: ['butterfly_exam', 'sorumluluk_sinav', 'messaging', 'teacher_agenda', 'duty', 'bilsem', 'optical', 'smart_board', 'tv', 'school_reviews', 'document', 'outcome', 'ders_dagit'],
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

  async seedDt22d(input?: {
    school_id?: string;
    year?: number;
    file_no?: string;
    subject?: string;
  }): Promise<{
    schoolId: string;
    userId: string;
    dtFileId: string;
    vendorIds: string[];
    quoteIds: { research: string[]; bid: string | null };
    message: string;
  }> {
    const year = input?.year ?? new Date().getFullYear();

    const school =
      (input?.school_id ? await this.schoolRepo.findOne({ where: { id: input.school_id } }) : null) ??
      (await this.resolveCanonicalDemoSchool()) ??
      (await this.schoolRepo.findOne({ order: { id: 'ASC' as any } }));
    if (!school) throw new Error('No school found');

    const users = await this.userRepo.find({ where: { school_id: school.id }, order: { id: 'ASC' as any }, take: 8 });
    const fallbackUsers = users.length ? users : await this.userRepo.find({ order: { id: 'ASC' as any }, take: 8 });
    if (!fallbackUsers.length) throw new Error('No users found');
    const user = fallbackUsers.find((u) => u.role === UserRole.school_admin) ?? fallbackUsers[0]!;

    const subject = input?.subject ?? '22/d Örnek Alım (Temizlik Malzemesi)';
    const fileNo = input?.file_no ?? `DT-22D-${String(year).slice(-2)}-${String(Date.now()).slice(-4)}`;
    const procurementRef = `dt-${Math.random().toString(16).slice(2, 8)}`;

    await this.dtSettingsRepo.save(
      this.dtSettingsRepo.create({
        schoolId: school.id,
        headerLine2: 'KAYMAKAMLIĞI',
        headerLine3: 'İlçe Milli Eğitim Müdürlüğü',
        headerLine4: (school.name ?? '').trim() || 'Okul',
        officialCorrespondenceCode: '123456789',
        realizationAuthorityName: user.display_name ?? 'Müdür Yardımcısı',
        realizationAuthorityTitle: 'Müdür Yardımcısı',
        spendingAuthorityName: school.principalName ?? 'Müdür',
        spendingAuthorityTitle: 'Müdür',
      }),
    );

    const vendors = await Promise.all(
      [
        { title: 'A. FİRMASI', taxNo: '1234567891', address: 'Örnek Mah. 1. Cad. No:1', phone: '0500 000 00 01', email: 'a@firma.local' },
        { title: 'B. FİRMASI', taxNo: '1234567892', address: 'Örnek Mah. 2. Cad. No:2', phone: '0500 000 00 02', email: 'b@firma.local' },
        { title: 'C. FİRMASI', taxNo: '1234567893', address: 'Örnek Mah. 3. Cad. No:3', phone: '0500 000 00 03', email: 'c@firma.local' },
      ].map(async (v) => {
        const existing = await this.dtVendorRepo.findOne({ where: { schoolId: school.id, title: v.title } });
        if (existing) return existing;
        return this.dtVendorRepo.save(
          this.dtVendorRepo.create({
            schoolId: school.id,
            title: v.title,
            taxNo: v.taxNo,
            address: v.address,
            phone: v.phone,
            email: v.email,
            contactName: v.title,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          }),
        );
      }),
    );

    const dtFile = await this.dtFileRepo.save(
      this.dtFileRepo.create({
        schoolId: school.id,
        year,
        fileNo,
        subject,
        teminType: '22d_dig_isler',
        status: 'draft',
        awardMode: 'manual',
        budgetAccountId: null,
        approxTotal: null,
        decisionTotal: null,
        paymentTotal: null,
        procurementRef,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        archivedAt: null,
      }),
    );

    const items = await this.dtItemRepo.save(
      [
        { name: 'Sıvı El Sabunu', spec: 'Parfüm içermeyecek, kolay durulanabilir', qty: '10', unit: 'Adet' },
        { name: 'Yüzey Temizleyici', spec: 'pH 7.0 ±0.5, 5L bidon', qty: '6', unit: 'Bidon' },
        { name: 'Çamaşır Suyu', spec: '%5 sodyum hipoklorit', qty: '8', unit: 'Bidon' },
      ].map((x) =>
        this.dtItemRepo.create({
          schoolId: school.id,
          dtFileId: dtFile.id,
          name: x.name,
          spec: x.spec,
          qty: x.qty,
          unit: x.unit,
          vatRate: 20,
          estimatedUnitPrice: null,
          estimatedTotal: null,
        }),
      ),
    );

    const d0 = new Date();
    const dStr = (d: Date) => d.toISOString().slice(0, 10);
    const stages: Array<{ stage: string; ref: string; seq: string; meta?: Record<string, unknown> }> = [
      { stage: 'ihtiyac_listesi', ref: '934.01.01', seq: '1' },
      { stage: 'komisyon_onay', ref: '934.01.99', seq: '2' },
      { stage: 'fiyat_arastirma', ref: '934.02.03', seq: '3' },
      { stage: 'yaklasik_maliyet', ref: '934.02.04', seq: '4' },
      { stage: 'ihale_onay', ref: '934.01.02', seq: '5' },
      { stage: 'teklif_mektubu', ref: '934.02.05', seq: '6' },
      { stage: 'piyasa_arastirma', ref: '934.02.06', seq: '7' },
      { stage: 'muayene_kabul', ref: '934.02.07', seq: '8', meta: { karar_no: `${year}/1` } },
    ];

    await this.dtRegistryRepo.save(
      stages.map((s) =>
        this.dtRegistryRepo.create({
          schoolId: school.id,
          dtFileId: dtFile.id,
          stage: s.stage,
          docDate: dStr(d0),
          numberPrefix: `123456789-${s.ref}`,
          numberSuffix: s.seq,
          meta: s.meta ?? {},
        }),
      ),
    );

    const memberPool = (users.length ? users : fallbackUsers).slice(0, 3);
    const m1 = memberPool[0] ?? user;
    const m2 = memberPool[1] ?? user;
    const m3 = memberPool[2] ?? user;

    const commKinds: Array<{ kind: string; members: Array<{ u: User; duty: string; title: string }> }> = [
      { kind: 'yaklasik_maliyet', members: [{ u: m1, duty: 'Komisyon Üyesi', title: 'Müdür Yardımcısı' }, { u: m2, duty: 'Komisyon Üyesi', title: 'Öğretmen' }, { u: m3, duty: 'Komisyon Üyesi', title: 'Öğretmen' }] },
      { kind: 'piyasa_satinalma', members: [{ u: m1, duty: 'Komisyon Üyesi', title: 'Müdür Yardımcısı' }, { u: m2, duty: 'Komisyon Üyesi', title: 'Öğretmen' }, { u: m3, duty: 'Komisyon Üyesi', title: 'Öğretmen' }] },
      { kind: 'muayene_kabul', members: [{ u: m1, duty: 'Komisyon Üyesi', title: 'Öğretmen' }, { u: m2, duty: 'Komisyon Üyesi', title: 'Öğretmen' }, { u: m3, duty: 'Komisyon Üyesi', title: 'Öğretmen' }] },
    ];

    for (const ck of commKinds) {
      const c = await this.dtCommissionRepo.save(
        this.dtCommissionRepo.create({
          schoolId: school.id,
          dtFileId: dtFile.id,
          kind: ck.kind,
          chairmanUserId: ck.members[0]?.u.id ?? null,
          createdByUserId: user.id,
        }),
      );
      await this.dtCommissionMemberRepo.save(
        ck.members.map((m) =>
          this.dtCommissionMemberRepo.create({
            commissionId: c.id,
            userId: m.u.id,
            title: m.title,
            dutyLabel: m.duty,
          }),
        ),
      );
    }

    const researchQuotes = await Promise.all(
      vendors.map((v) =>
        this.dtQuoteRepo.save(
          this.dtQuoteRepo.create({
            schoolId: school.id,
            dtFileId: dtFile.id,
            vendorId: v.id,
            purpose: 'market_research',
            status: 'received',
            requestedAt: d0,
            receivedAt: d0,
            note: null,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          }),
        ),
      ),
    );

    const basePrices = [12.0, 8.0, 10.0]; // A,B,C multiplier base
    for (let qi = 0; qi < researchQuotes.length; qi += 1) {
      const q = researchQuotes[qi]!;
      const mul = basePrices[qi] ?? 10.0;
      await this.dtQuoteItemRepo.save(
        items.map((it, idx) => {
          const unit = (idx + 1) * (mul / 10);
          const total = unit * Number(it.qty);
          return this.dtQuoteItemRepo.create({
            schoolId: school.id,
            quoteId: q.id,
            dtItemId: it.id,
            unitPrice: unit.toFixed(2),
            total: total.toFixed(2),
          });
        }),
      );
    }

    const bidVendor = vendors[0]!;
    const bidQuote = await this.dtQuoteRepo.save(
      this.dtQuoteRepo.create({
        schoolId: school.id,
        dtFileId: dtFile.id,
        vendorId: bidVendor.id,
        purpose: 'bid',
        status: 'accepted',
        requestedAt: d0,
        receivedAt: d0,
        note: 'Örnek kabul edilen teklif',
        createdByUserId: user.id,
        updatedByUserId: user.id,
      }),
    );

    await this.dtQuoteItemRepo.save(
      items.map((it, idx) => {
        const unit = (idx + 1) * 1.0;
        const total = unit * Number(it.qty);
        return this.dtQuoteItemRepo.create({
          schoolId: school.id,
          quoteId: bidQuote.id,
          dtItemId: it.id,
          unitPrice: unit.toFixed(2),
          total: total.toFixed(2),
        });
      }),
    );

    const awards = await this.dtAwardRepo.save(
      items.map((it, idx) => {
        const unit = (idx + 1) * 1.0;
        const total = unit * Number(it.qty);
        return this.dtAwardRepo.create({
          schoolId: school.id,
          dtFileId: dtFile.id,
          dtItemId: it.id,
          vendorId: bidVendor.id,
          unitPrice: unit.toFixed(2),
          total: total.toFixed(2),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        });
      }),
    );

    const decisionTotal = awards.reduce((acc, a) => acc + Number(a.total ?? 0), 0);
    const approxTotal = decisionTotal; // demo

    const budgetAccount = await this.dtBudgetAccountRepo.save(
      this.dtBudgetAccountRepo.create({
        schoolId: school.id,
        year,
        parentId: null,
        code: '255.255.192.168',
        label: 'Örnek bütçe tertibi',
        allocated: '110000.00',
        blocked: String(decisionTotal.toFixed(2)),
        spent: String(decisionTotal.toFixed(2)),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      }),
    );

    await this.dtBudgetBlockRepo.save(
      this.dtBudgetBlockRepo.create({
        schoolId: school.id,
        dtFileId: dtFile.id,
        budgetAccountId: budgetAccount.id,
        amount: String(decisionTotal.toFixed(2)),
        status: 'blocked',
        blockedAt: d0,
        releasedAt: null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      }),
    );

    await this.dtPaymentRepo.save(
      this.dtPaymentRepo.create({
        schoolId: school.id,
        dtFileId: dtFile.id,
        quoteId: bidQuote.id,
        amount: String(decisionTotal.toFixed(2)),
        paidAt: d0,
        note: 'Örnek 22/d ödeme (test)',
        referenceNo: `HYS-${year}-0001`,
        createdByUserId: user.id,
      }),
    );

    await this.dtFileRepo.update(
      { id: dtFile.id, schoolId: school.id },
      {
        approxTotal: String(approxTotal.toFixed(2)),
        decisionTotal: String(decisionTotal.toFixed(2)),
        paymentTotal: String(decisionTotal.toFixed(2)),
        budgetAccountId: budgetAccount.id,
        updatedByUserId: user.id,
      } as any,
    );

    return {
      schoolId: school.id,
      userId: user.id,
      dtFileId: dtFile.id,
      vendorIds: vendors.map((v) => v.id),
      quoteIds: { research: researchQuotes.map((q) => q.id), bid: bidQuote.id },
      message: `Seed OK: /dogrudan-temin/${dtFile.id}`,
    };
  }
}
