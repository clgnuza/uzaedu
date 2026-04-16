import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentTemplate } from './entities/document-template.entity';
import { ListDocumentTemplatesDto } from './dto/list-document-templates.dto';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { UploadService } from '../upload/upload.service';
import { DocumentCatalogService } from './document-catalog.service';
import { getAcademicYearOptions } from '../config/document-template-options';
import { YillikPlanIcerikService } from '../yillik-plan-icerik/yillik-plan-icerik.service';

/**
 * Yıllık plan Word çıktısı docxtemplater ile şablondan değil, kodla üretilir (generateYillikPlanDocx).
 * DB’deki fileUrl yine de indirme / tutarlılık için gerçek .docx yolunu göstermeli; eski .xlsx R2 linki hatalıydı.
 */
const YILLIK_PLAN_DOCX_LOCAL_REF = 'local:ornek-yillik-plan-modern.docx';

@Injectable()
export class DocumentTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(DocumentTemplatesService.name);

  constructor(
    @InjectRepository(DocumentTemplate)
    private readonly repo: Repository<DocumentTemplate>,
    private readonly uploadService: UploadService,
    private readonly catalogService: DocumentCatalogService,
    private readonly yillikPlanIcerikService: YillikPlanIcerikService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupExampleTemplates();
    await this.ensureYillikPlanTemplate();
    await this.ensureMaarifYillikPlanTemplates();
    await this.ensureBilsemYillikPlanTemplate();
    this.checkRequiredTemplatesExist();
  }

  /** Örnek/eskimiş şablonları siler (veli tutanak vb.). Sadece yıllık plan kalır. */
  private async cleanupExampleTemplates(): Promise<void> {
    const toRemove = await this.repo.find({
      where: [{ type: 'veli_toplanti_tutanak' }, { type: 'kulup_evrak' }, { type: 'dilekce' }],
    });
    for (const t of toRemove) {
      await this.repo.remove(t);
      this.logger.log(`Örnek şablon silindi: ${t.type} (${t.id})`);
    }
  }

  /** Yerel şablon dosyasının varlığını kontrol eder; eksikse uyarı loglar. */
  private checkRequiredTemplatesExist(): void {
    const templatesDir = path.join(process.cwd(), 'templates');
    const file = 'ornek-yillik-plan-modern.docx';
    const filePath = path.join(templatesDir, file);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(
        `Evrak şablonu bulunamadı: ${file} (${path.relative(process.cwd(), filePath)}) – npm run create-modern-yillik-plan`,
      );
    }
  }

  /** Tek yıllık plan şablonu (Coğrafya). Superadmin takvim + plan içeriği girer; öğretmen üretir, indirir. */
  private async ensureYillikPlanTemplate(): Promise<void> {
    const fileUrl = YILLIK_PLAN_DOCX_LOCAL_REF;
    const fileUrlLocal = YILLIK_PLAN_DOCX_LOCAL_REF;

    const all = await this.repo.find({
      where: { type: 'yillik_plan', subjectCode: 'cografya' },
      order: { createdAt: 'ASC' },
    });
    if (all.length > 1) {
      for (let i = 1; i < all.length; i++) await this.repo.remove(all[i]);
    }
    const existing = all[0] ?? null;
    if (existing) {
      let changed = false;
      if (existing.section !== null || existing.schoolType !== null) {
        existing.section = null;
        existing.schoolType = null;
        changed = true;
      }
      if (existing.fileUrl !== fileUrl) {
        existing.fileUrl = fileUrl;
        changed = true;
      }
      if (existing.fileUrlLocal !== fileUrlLocal) {
        existing.fileUrlLocal = fileUrlLocal;
        changed = true;
      }
      if (existing.fileFormat !== 'docx') {
        existing.fileFormat = 'docx';
        changed = true;
      }
      if (changed) await this.repo.save(existing);
      const fullSchema = [
        { key: 'ogretim_yili', label: 'Öğretim Yılı', type: 'text', required: true },
        { key: 'sinif', label: 'Sınıf', type: 'text', required: true },
        { key: 'okul_adi', label: 'Çalıştığınız Okulun Tam Adı', type: 'text', required: true },
        { key: 'mudur_adi', label: 'Müdür Adı', type: 'text', required: true },
        { key: 'onay_tarihi', label: 'Onay Tarihi', type: 'text', required: true },
        { key: 'zumre_ogretmenleri', label: 'Zümre Öğretmenleri (virgülle ayırın)', type: 'textarea', required: false },
      ];
      
      // Schema'yı kontrol et - zumre_ogretmenleri alanı var mı?
      const hasZumreField = Array.isArray(existing.formSchema) &&
        existing.formSchema.some((item: any) => item?.key === 'zumre_ogretmenleri');
      
      if (!existing.requiresMerge || !hasZumreField) {
        existing.requiresMerge = true;
        existing.formSchema = fullSchema;
        await this.repo.save(existing);
        this.logger.log('Yıllık plan şablonu form schema güncellendi (zumre_ogretmenleri eklendi)');
      }
      return;
    }
    await this.repo.save(
      this.repo.create({
        type: 'yillik_plan',
        subType: null,
        schoolType: null,
        grade: null,
        section: null,
        subjectCode: 'cografya',
        subjectLabel: 'Coğrafya',
        curriculumModel: null,
        academicYear: null,
        version: '1',
        fileUrl,
        fileUrlLocal,
        fileFormat: 'docx',
        isActive: true,
        requiresMerge: true,
        formSchema: [
          { key: 'ogretim_yili', label: 'Öğretim Yılı', type: 'text', required: true },
          { key: 'sinif', label: 'Sınıf', type: 'text', required: true },
          { key: 'okul_adi', label: 'Çalıştığınız Okulun Tam Adı', type: 'text', required: true },
          { key: 'mudur_adi', label: 'Müdür Adı', type: 'text', required: true },
          { key: 'onay_tarihi', label: 'Onay Tarihi', type: 'text', required: true },
          { key: 'zumre_ogretmenleri', label: 'Zümre Öğretmenleri (virgülle ayırın)', type: 'textarea', required: false },
        ],
        sortOrder: 10,
      }),
    );
  }

  private async ensureMaarifYillikPlanTemplates(): Promise<void> {
    const variants = [
      { subjectCode: 'cografya_maarif_al', subjectLabel: 'Coğrafya - Maarif M. (A.L.)', sortOrder: 11 },
      { subjectCode: 'cografya_maarif_fl', subjectLabel: 'Coğrafya - Maarif M. (F.L.)', sortOrder: 12 },
      { subjectCode: 'cografya_maarif_sbl', subjectLabel: 'Coğrafya - Maarif M. (S.B.L.)', sortOrder: 13 },
    ] as const;
    const fileUrl = YILLIK_PLAN_DOCX_LOCAL_REF;
    const fileUrlLocal = YILLIK_PLAN_DOCX_LOCAL_REF;
    const formSchema = [
      { key: 'ogretim_yili', label: 'Öğretim Yılı', type: 'text', required: true },
      { key: 'sinif', label: 'Sınıf', type: 'text', required: true },
      { key: 'okul_adi', label: 'Çalıştığınız Okulun Tam Adı', type: 'text', required: true },
      { key: 'mudur_adi', label: 'Müdür Adı', type: 'text', required: true },
      { key: 'onay_tarihi', label: 'Onay Tarihi', type: 'text', required: true },
      { key: 'zumre_ogretmenleri', label: 'Zümre Öğretmenleri (virgülle ayırın)', type: 'textarea', required: false },
    ];

    for (const variant of variants) {
      const all = await this.repo.find({
        where: { type: 'yillik_plan', subjectCode: variant.subjectCode },
        order: { createdAt: 'ASC' },
      });
      if (all.length > 1) {
        for (let i = 1; i < all.length; i++) await this.repo.remove(all[i]);
      }
      const existing = all[0] ?? null;
      if (existing) {
        let changed = false;
        if (existing.section !== null || existing.schoolType !== null) {
          existing.section = null;
          existing.schoolType = null;
          changed = true;
        }
        if (existing.fileUrl !== fileUrl) {
          existing.fileUrl = fileUrl;
          changed = true;
        }
        if (existing.fileUrlLocal !== fileUrlLocal) {
          existing.fileUrlLocal = fileUrlLocal;
          changed = true;
        }
        if (existing.fileFormat !== 'docx') {
          existing.fileFormat = 'docx';
          changed = true;
        }
        if (!existing.requiresMerge) {
          existing.requiresMerge = true;
          changed = true;
        }
        const hasZumreField = Array.isArray(existing.formSchema) &&
          existing.formSchema.some((item: any) => item?.key === 'zumre_ogretmenleri');
        if (!hasZumreField) {
          existing.formSchema = formSchema;
          changed = true;
        }
        if (changed) await this.repo.save(existing);
        continue;
      }
      await this.repo.save(
        this.repo.create({
          type: 'yillik_plan',
          subType: null,
          schoolType: null,
          grade: null,
          section: null,
          subjectCode: variant.subjectCode,
          subjectLabel: variant.subjectLabel,
          curriculumModel: null,
          academicYear: null,
          version: '1',
          fileUrl,
          fileUrlLocal,
          fileFormat: 'docx',
          isActive: true,
          requiresMerge: true,
          formSchema,
          sortOrder: variant.sortOrder,
        }),
      );
    }
  }

  /**
   * Bilsem yıllık plan Word şablonu — MEB yıllık plan ile aynı yerel/R2 gövde (merge: yillik_plan tablosu + PÜY).
   * subject_code NULL: öğretmen sihirbazında seçilen tüm bilsem_* dersleriyle eşleşir.
   */
  private async ensureBilsemYillikPlanTemplate(): Promise<void> {
    const fileUrl = YILLIK_PLAN_DOCX_LOCAL_REF;
    const fileUrlLocal = YILLIK_PLAN_DOCX_LOCAL_REF;

    const bilsemFormSchema = [
      { key: 'ogretim_yili', label: 'Öğretim Yılı', type: 'text', required: true },
      { key: 'sinif', label: 'Ana / alt grup (belgede görünen)', type: 'text', required: false },
      { key: 'ana_grup', label: 'Ana grup (kod)', type: 'text', required: false },
      { key: 'alt_grup', label: 'Alt grup (kod)', type: 'text', required: false },
      { key: 'okul_adi', label: 'Çalıştığınız Okulun Tam Adı', type: 'text', required: true },
      { key: 'mudur_adi', label: 'Müdür Adı', type: 'text', required: true },
      { key: 'onay_tarihi', label: 'Onay Tarihi', type: 'text', required: true },
      { key: 'zumre_ogretmenleri', label: 'Zümre Öğretmenleri (virgülle ayırın)', type: 'textarea', required: false },
    ];

    const all = await this.repo
      .createQueryBuilder('t')
      .where('t.type = :type', { type: 'yillik_plan' })
      .andWhere('t.curriculum_model = :cm', { cm: 'bilsem' })
      .andWhere('t.subject_code IS NULL')
      .orderBy('t.created_at', 'ASC')
      .getMany();

    if (all.length > 1) {
      for (let i = 1; i < all.length; i++) await this.repo.remove(all[i]);
    }
    const existing = all[0] ?? null;

    if (existing) {
      let changed = false;
      if (existing.section !== null || existing.schoolType !== null) {
        existing.section = null;
        existing.schoolType = null;
        changed = true;
      }
      if (existing.fileUrl !== fileUrl) {
        existing.fileUrl = fileUrl;
        changed = true;
      }
      if (existing.fileUrlLocal !== fileUrlLocal) {
        existing.fileUrlLocal = fileUrlLocal;
        changed = true;
      }
      if (existing.fileFormat !== 'docx') {
        existing.fileFormat = 'docx';
        changed = true;
      }
      if (!existing.requiresMerge) {
        existing.requiresMerge = true;
        changed = true;
      }
      let schemaChanged = false;
      const fs = [...(existing.formSchema ?? [])];
      for (const add of [
        { key: 'ana_grup', label: 'Ana grup (kod)', type: 'text', required: false as const },
        { key: 'alt_grup', label: 'Alt grup (kod)', type: 'text', required: false as const },
      ]) {
        if (!fs.some((x) => x.key === add.key)) {
          fs.push(add);
          schemaChanged = true;
        }
      }
      if (schemaChanged) {
        existing.formSchema = fs;
        changed = true;
      }
      if (changed) await this.repo.save(existing);
      return;
    }

    await this.repo.save(
      this.repo.create({
        type: 'yillik_plan',
        subType: null,
        schoolType: null,
        grade: null,
        section: null,
        subjectCode: null,
        subjectLabel: 'Bilsem yıllık plan (genel şablon)',
        curriculumModel: 'bilsem',
        academicYear: null,
        version: '1',
        fileUrl,
        fileUrlLocal,
        fileFormat: 'docx',
        isActive: true,
        requiresMerge: true,
        formSchema: bilsemFormSchema,
        sortOrder: 12,
      }),
    );
    this.logger.log('Bilsem yıllık plan şablonu (genel) oluşturuldu veya güncellendi.');
  }

  async getSubjects(
    grade?: number,
    section?: string,
    hasPlanContentOnly?: boolean,
    academicYear?: string,
    curriculumModel?: string,
    anaGrup?: string,
    altGrup?: string,
  ): Promise<{ items: Array<{ code: string; label: string; ana_grup?: string | null }> }> {
    const cm = curriculumModel?.trim();
    const catalogItems = await this.catalogService.findSubjects(grade, section, cm);
    let items = catalogItems.map((c) => {
      const row: { code: string; label: string; ana_grup?: string | null } = {
        code: c.code,
        label: c.label,
      };
      if (cm === 'bilsem') row.ana_grup = c.anaGrup ?? null;
      return row;
    });
    if (hasPlanContentOnly && cm === 'bilsem') {
      const planParams: { academic_year?: string; ana_grup?: string; alt_grup?: string } = {};
      if (academicYear?.trim()) planParams.academic_year = academicYear.trim();
      if (anaGrup?.trim()) planParams.ana_grup = anaGrup.trim();
      if (altGrup !== undefined) planParams.alt_grup = altGrup;
      const [withTemplate, withPlan] = await Promise.all([
        this.getSubjectCodesWithYillikPlanTemplate(undefined, section, 'bilsem'),
        this.yillikPlanIcerikService.getSubjectCodesWithPlanBilsem(planParams),
      ]);
      const set = new Set(
        [...withTemplate, ...withPlan].map((c) => c.toLowerCase().trim()),
      );
      items = items.filter((s) => set.has(s.code.toLowerCase().trim()));
    } else if (hasPlanContentOnly && grade != null && cm !== 'bilsem') {
      const withPlan = await this.yillikPlanIcerikService.getSubjectCodesWithPlan({
        grade,
        academic_year: academicYear,
      });
      const set = new Set(withPlan.map((c) => c.toLowerCase().trim()));
      items = items.filter((s) => set.has(s.code.toLowerCase().trim()));
    }
    return { items };
  }

  /** Aktif yıllık plan şablonu olan ders kodları (öğretmen evrak sayfası için – plan içeriği olmasa da göster) */
  private async getSubjectCodesWithYillikPlanTemplate(
    grade?: number,
    section?: string,
    curriculumModel?: string,
  ): Promise<string[]> {
    const qb = this.repo
      .createQueryBuilder('t')
      .select('DISTINCT t.subject_code')
      .where('t.type = :type', { type: 'yillik_plan' })
      .andWhere('t.is_active = true')
      .andWhere('t.subject_code IS NOT NULL')
      .andWhere("t.subject_code != ''");
    if (grade != null && grade >= 1 && grade <= 12) {
      qb.andWhere('(t.grade IS NULL OR t.grade = :grade)', { grade });
    }
    if (section?.trim()) {
      qb.andWhere('(t.section IS NULL OR t.section = :section)', { section });
    }
    if (curriculumModel?.trim()) {
      qb.andWhere('t.curriculum_model = :cm', { cm: curriculumModel.trim() });
    }
    const rows = await qb.getRawMany<{ subject_code: string }>();
    return rows.map((r) => r.subject_code).filter(Boolean);
  }

  async getCatalogList(params: {
    category?: string;
    parentCode?: string;
    grade?: number;
    section?: string;
  }) {
    return this.catalogService.list(params);
  }

  async getOptions(
    type?: string
  ): Promise<{
    sub_types: { value: string; label: string }[];
    school_types: { value: string; label: string }[];
    sections: { value: string; label: string }[];
    academic_years: string[];
    evrak_types: { value: string; label: string }[];
  }> {
    const [subTypes, schoolTypes, sections, evrakTypes] = await Promise.all([
      type ? this.catalogService.findSubTypesByParent(type) : Promise.resolve([]),
      this.catalogService.findAllByCategory('school_type'),
      this.catalogService.findAllByCategory('section'),
      this.catalogService.findAllByCategory('evrak_type'),
    ]);
    return {
      sub_types: subTypes.map((c) => ({ value: c.code, label: c.label })),
      school_types: schoolTypes.map((c) => ({ value: c.code, label: c.label })),
      sections: sections.map((c) => ({ value: c.code, label: c.label })),
      academic_years: getAcademicYearOptions(),
      evrak_types: evrakTypes.map((c) => ({ value: c.code, label: c.label })),
    };
  }

  async findAll(dto: ListDocumentTemplatesDto): Promise<{
    total: number;
    page: number;
    limit: number;
    items: DocumentTemplate[];
  }> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 20));

    // ValidationPipe bazen grade'i NaN yapabiliyor; geçersizse yoksay
    const grade =
      typeof dto.grade === 'number' && !Number.isNaN(dto.grade) && dto.grade >= 1 && dto.grade <= 12
        ? dto.grade
        : undefined;

    const qb = this.repo.createQueryBuilder('t').orderBy('t.sort_order', 'ASC').addOrderBy('t.created_at', 'DESC');

    if (dto.type) qb.andWhere('t.type = :type', { type: dto.type });
    if (dto.sub_type) qb.andWhere('t.sub_type = :sub_type', { sub_type: dto.sub_type });
    if (dto.school_type) qb.andWhere('t.school_type = :school_type', { school_type: dto.school_type });
    // grade=null şablonlar tüm sınıflara uygulanır
    if (grade != null) qb.andWhere('(t.grade IS NULL OR t.grade = :grade)', { grade });
    // section=null şablonlar tüm bölümlere uygulanır (öğretmen 5-12. sınıf için bölüm seçtiğinde eşleşme)
    if (dto.section) qb.andWhere('(t.section IS NULL OR t.section = :section)', { section: dto.section });
    // Derse özel şablon VEYA subject_code NULL/'' (birleşik/genel şablon) – öğretmen her zaman en az bir şablon görsün
    if (dto.subject_code?.trim()) {
      qb.andWhere("(t.subject_code = :subject_code OR t.subject_code IS NULL OR t.subject_code = '')", {
        subject_code: dto.subject_code.trim(),
      });
    }
    // academic_year=null şablonlar tüm öğretim yıllarına uygulanır
    if (dto.academic_year) qb.andWhere('(t.academic_year IS NULL OR t.academic_year = :academic_year)', { academic_year: dto.academic_year });
    if (dto.curriculum_model?.trim()) {
      qb.andWhere('t.curriculum_model = :curriculum_model', {
        curriculum_model: dto.curriculum_model.trim(),
      });
    } else if (dto.exclude_curriculum_model?.trim()) {
      qb.andWhere('(t.curriculum_model IS NULL OR t.curriculum_model != :excl)', {
        excl: dto.exclude_curriculum_model.trim(),
      });
    }
    if (dto.active_only !== false) qb.andWhere('t.is_active = true');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { total, page, limit, items };
  }

  async findOne(id: string): Promise<DocumentTemplate> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Şablon bulunamadı.' });
    return t;
  }

  async getDownloadUrl(id: string): Promise<{ download_url: string; filename: string }> {
    const t = await this.findOne(id);
    if (!t.isActive) throw new BadRequestException({ code: 'INACTIVE', message: 'Bu şablon artık kullanılamıyor.' });

    const fileUrl = t.fileUrl;
    const ext = t.fileFormat || 'docx';
    const filename = this.buildStaticFilename(t, ext);

    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return { download_url: fileUrl, filename };
    }

    if (fileUrl.startsWith('local:')) {
      const localName = fileUrl.slice(6).trim() || 'ornek-yillik-plan-modern.docx';
      const filePath = path.join(process.cwd(), 'templates', localName);
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException({
          code: 'TEMPLATE_NOT_FOUND',
          message: `Yerel şablon yok: backend/templates/${localName} — projede \`npm run create-modern-yillik-plan\` çalıştırın veya dosyayı bu klasöre koyun.`,
        });
      }
      const buf = fs.readFileSync(filePath);
      const ct =
        ext === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      try {
        const key = `document_template/local-pull/${randomUUID()}-${localName.replace(/[^\w.-]/g, '_')}`;
        await this.uploadService.uploadBuffer(key, buf, ct);
        const signedUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
        return { download_url: signedUrl, filename };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/R2|bucket|r2_bucket/i.test(msg)) {
          throw new BadRequestException({
            code: 'R2_NOT_CONFIGURED',
            message: `Şablon dosyası sunucuda: ${filePath}. İndirme linki için R2 yapılandırın veya bu dosyayı doğrudan kopyalayın.`,
          });
        }
        throw e;
      }
    }

    const signedUrl = await this.uploadService.getSignedDownloadUrl(
      fileUrl,
      3600,
      filename,
    );
    return { download_url: signedUrl, filename };
  }

  /** Statik indirme için okunabilir dosya adı */
  private buildStaticFilename(t: DocumentTemplate, ext: string): string {
    const sanitize = (s: string) =>
      String(s || '')
        .replace(/[^\w\u00C0-\u024F\s.-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'evrak';
    const ders = sanitize(t.subjectLabel ?? t.subjectCode ?? '');
    const sinif = t.grade != null ? String(t.grade) : '';
    const yil = t.academicYear ? sanitize(t.academicYear) : '';
    const typeLabel =
      t.type === 'yillik_plan'
        ? 'Yillik-Plan'
        : t.type === 'gunluk_plan'
          ? 'Gunluk-Plan'
          : t.type === 'zumre'
            ? 'Zumre'
            : t.type;
    if (t.type === 'yillik_plan' && ders) {
      const parts = sinif ? [`${sinif}-Sinif`, ders] : [ders];
      return `${parts.join('-')}-${typeLabel}${yil ? `-${yil}` : ''}.${ext}`;
    }
    if (t.type === 'zumre' && ders) {
      return `${ders}-${typeLabel}${yil ? `-${yil}` : ''}.${ext}`;
    }
    return `${typeLabel}-${ders || 'evrak'}${yil ? `-${yil}` : ''}.${ext}`;
  }

  async create(dto: CreateDocumentTemplateDto): Promise<DocumentTemplate> {
    const t = this.repo.create({
      type: dto.type,
      subType: dto.sub_type ?? null,
      schoolType: dto.school_type ?? null,
      grade: dto.grade ?? null,
      section: dto.section ?? null,
      subjectCode: dto.subject_code ?? null,
      subjectLabel: dto.subject_label ?? null,
      curriculumModel: dto.curriculum_model ?? null,
      academicYear: dto.academic_year ?? null,
      version: dto.version,
      fileUrl: dto.file_url,
      fileUrlLocal: dto.file_url_local ?? null,
      fileFormat: dto.file_format ?? 'docx',
      isActive: dto.is_active ?? true,
      requiresMerge: dto.requires_merge ?? false,
      formSchema: dto.form_schema ?? null,
      sortOrder: dto.sort_order ?? null,
    });
    return this.repo.save(t);
  }

  async update(id: string, dto: UpdateDocumentTemplateDto): Promise<DocumentTemplate> {
    const t = await this.findOne(id);
    if (dto.type !== undefined) t.type = dto.type;
    if (dto.sub_type !== undefined) t.subType = dto.sub_type;
    if (dto.school_type !== undefined) t.schoolType = dto.school_type;
    if (dto.grade !== undefined) t.grade = dto.grade;
    if (dto.section !== undefined) t.section = dto.section;
    if (dto.subject_code !== undefined) t.subjectCode = dto.subject_code;
    if (dto.subject_label !== undefined) t.subjectLabel = dto.subject_label;
    if (dto.curriculum_model !== undefined) t.curriculumModel = dto.curriculum_model;
    if (dto.academic_year !== undefined) t.academicYear = dto.academic_year;
    if (dto.version !== undefined) t.version = dto.version;
    if (dto.file_url !== undefined) t.fileUrl = dto.file_url;
    if (dto.file_url_local !== undefined) t.fileUrlLocal = dto.file_url_local;
    if (dto.file_format !== undefined) t.fileFormat = dto.file_format;
    if (dto.is_active !== undefined) t.isActive = dto.is_active;
    if (dto.requires_merge !== undefined) t.requiresMerge = dto.requires_merge;
    if (dto.form_schema !== undefined) t.formSchema = dto.form_schema;
    if (dto.sort_order !== undefined) t.sortOrder = dto.sort_order;
    return this.repo.save(t);
  }

  async remove(id: string): Promise<void> {
    const t = await this.findOne(id);
    await this.repo.remove(t);
  }
}
