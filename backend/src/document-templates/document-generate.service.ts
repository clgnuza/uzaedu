import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { v4 as uuidv4 } from 'uuid';
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  Footer,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextDirection,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
  VerticalMergeType,
} from 'docx';
import { DocumentTemplate } from './entities/document-template.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { UploadService } from '../upload/upload.service';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentGeneration } from './entities/document-generation.entity';
import { BilsemPlanCreatorRewardService } from '../bilsem/bilsem-plan-creator-reward.service';
import { getAcademicYearOptions } from '../config/document-template-options';
import { getAyForWeek, hasMebCalendar, mebTeachingWeeksAsWorkCalendar } from '../config/meb-calendar';
import { resolveAyForYillikPlanRow } from '../yillik-plan-icerik/resolve-ay-for-plan-row.util';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { YillikPlanIcerikService } from '../yillik-plan-icerik/yillik-plan-icerik.service';
import { YillikPlanIcerik } from '../yillik-plan-icerik/entities/yillik-plan-icerik.entity';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { BilsemYillikPlanService } from '../bilsem/bilsem-yillik-plan.service';
import {
  applyBilsemPuyMergeRowDefaults,
  isBilsemSubjectCode,
} from '../bilsem/bilsem-puy-plan-constants';
import { EntitlementService } from '../entitlements/entitlement.service';
import {
  TABLE_STYLES,
  HEADER_STYLES,
  TABLE_LAYOUT,
  TEXT_STYLES,
  ORIENTATION,
} from './document-template-defaults';

@Injectable()
export class DocumentGenerateService {
  private readonly logger = new Logger(DocumentGenerateService.name);

  constructor(
    @InjectRepository(DocumentTemplate)
    private readonly templateRepo: Repository<DocumentTemplate>,
    private readonly uploadService: UploadService,
    private readonly yillikPlanIcerikService: YillikPlanIcerikService,
    private readonly workCalendarService: WorkCalendarService,
    private readonly generationService: DocumentGenerationService,
    private readonly bilsemYillikPlanService: BilsemYillikPlanService,
    private readonly entitlementService: EntitlementService,
    private readonly bilsemPlanCreatorReward: BilsemPlanCreatorRewardService,
  ) {}

  async generate(
    dto: GenerateDocumentDto,
    user: User,
    options?: { skipSave?: boolean },
  ): Promise<{ download_url: string; filename: string }> {
    const template = await this.templateRepo.findOne({
      where: { id: dto.template_id },
    });
    if (!template) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Şablon bulunamadı.',
      });
    }
    if (!template.isActive) {
      throw new BadRequestException({
        code: 'INACTIVE',
        message: 'Bu şablon artık kullanılamıyor.',
      });
    }
    if (!template.requiresMerge) {
      throw new BadRequestException({
        code: 'NO_MERGE',
        message: 'Bu şablon merge gerektirmiyor. Doğrudan indirin.',
      });
    }
    const format = template.fileFormat || 'docx';
    if (format !== 'docx' && format !== 'xlsx') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FORMAT',
        message: 'Sadece Word (.docx) ve Excel (.xlsx) şablonları merge destekler.',
      });
    }

    this.validateFormData(template, dto.form_data ?? {});
    const formData = dto.form_data ?? {};

    if (!options?.skipSave && !EntitlementService.isEvrakExempt(user.role as UserRole)) {
      if (template.type === 'yillik_plan') {
        await this.entitlementService.checkAndConsumeYillikPlanUretim(user.id);
      } else {
        await this.entitlementService.checkAndConsumeEvrak(user.id);
      }
    }

    // Modül etkinleştirmesi: RequireModuleActivationGuard (document|bilsem) + POST /market/modules/activate

    // Yıllık plan DOCX: runtime üret (şablon merge değil) — landscape, dar margin,
    // altta zümre sayısı kadar sütun + müdür adı.
    if (template.type === 'yillik_plan' && format === 'docx') {
      const outputBuffer = await this.generateYillikPlanDocx(template, user, formData);
      const ext = 'docx';
      const key = `generated/${uuidv4()}-evrak.${ext}`;
      try {
        await this.uploadService.uploadBuffer(
          key,
          outputBuffer,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
      } catch (err: unknown) {
        this.rethrowR2Error(err, 'upload');
      }
      const mergeData = this.buildMergeData(user, formData, template) as Record<string, string>;
      const filename = this.buildDownloadFilename(template, mergeData, ext);
      let downloadUrl: string;
      try {
        downloadUrl = await this.uploadService.getSignedDownloadUrl(
          key,
          3600,
          filename,
        );
      } catch (err: unknown) {
        this.rethrowR2Error(err, 'url');
      }
      let savedGen: DocumentGeneration | null = null;
      if (!options?.skipSave) {
        const displayLabel = this.buildDisplayLabel(template, mergeData);
        savedGen = await this.saveGenerationBestEffort(user, template, formData, displayLabel);
      }
      if (!options?.skipSave && savedGen) {
        await this.bilsemPlanCreatorReward.tryRewardAfterYillikPlanGeneration({
          consumerUserId: user.id,
          documentGenerationId: savedGen.id,
          template,
          formData,
        });
      }
      return { download_url: downloadUrl, filename };
    }

    const templateBuffer = await this.loadTemplateBuffer(
      template.fileUrl,
      template.fileUrlLocal,
    );

    let mergeData = this.buildMergeData(user, formData, template) as Record<string, unknown>;

    if (
      template.type === 'yillik_plan' &&
      format === 'docx' &&
      template.subjectCode
    ) {
      const haftalar = await this.fetchHaftalarForMerge(
        template,
        formData,
        mergeData as Record<string, string>,
        user,
      );
      const zumreOgretmenleriArray = this.parseZumreOgretmenleri(
        formData,
        user,
        template,
      );
      mergeData = { ...mergeData, haftalar, zumre_list: zumreOgretmenleriArray };
    }

    let outputBuffer: Buffer;
    try {
      outputBuffer =
        format === 'xlsx'
          ? this.mergeXlsx(templateBuffer, mergeData as Record<string, string>)
          : this.mergeDocx(templateBuffer, mergeData, template);
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : '';
      if (msg.includes('render') || msg.includes('tag') || (err && typeof err === 'object' && 'properties' in err)) {
        const props = (err as { properties?: { tag?: string } })?.properties;
        const tag = props?.tag ?? '';
        throw new BadRequestException({
          code: 'MERGE_ERROR',
          message: tag
            ? `Şablonda '${tag}' alanı bulunamadı veya eksik. Form verilerini kontrol edin.`
            : 'Şablon birleştirme hatası. Şablondaki alanlar ile form verileri uyuşmuyor olabilir.',
        });
      }
      if (msg.includes('corrupt') || msg.includes('zip') || msg.includes('load')) {
        throw new BadRequestException({
          code: 'TEMPLATE_CORRUPT',
          message: 'Şablon dosyası bozuk veya geçersiz format.',
        });
      }
      throw err;
    }

    const ext = format === 'xlsx' ? 'xlsx' : 'docx';
    const key = `generated/${uuidv4()}-evrak.${ext}`;
    const contentType =
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    try {
      await this.uploadService.uploadBuffer(key, outputBuffer, contentType);
    } catch (err: unknown) {
      this.rethrowR2Error(err, 'upload');
    }
    const filename = this.buildDownloadFilename(
      template,
      mergeData as Record<string, string>,
      ext,
    );
    let downloadUrl: string;
    try {
      downloadUrl = await this.uploadService.getSignedDownloadUrl(
        key,
        3600,
        filename,
      );
    } catch (err: unknown) {
      this.rethrowR2Error(err, 'url');
    }

    let savedGenMerge: DocumentGeneration | null = null;
    if (!options?.skipSave) {
      const displayLabel = this.buildDisplayLabel(template, mergeData as Record<string, string>);
      savedGenMerge = await this.saveGenerationBestEffort(user, template, formData, displayLabel);
    }
    if (!options?.skipSave && savedGenMerge) {
      await this.bilsemPlanCreatorReward.tryRewardAfterYillikPlanGeneration({
        consumerUserId: user.id,
        documentGenerationId: savedGenMerge.id,
        template,
        formData,
      });
    }

    return { download_url: downloadUrl, filename };
  }

  private rethrowR2Error(err: unknown, phase: 'upload' | 'url'): never {
    if (err instanceof BadRequestException) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpException(
      {
        code: 'EXTERNAL_SERVICE_ERROR',
        message:
          phase === 'upload'
            ? `Üretilen dosya depoya yüklenemedi. R2 ayarlarını ve ağı kontrol edin. (${msg.slice(0, 120)})`
            : `İndirme bağlantısı oluşturulamadı. R2 ayarlarını kontrol edin. (${msg.slice(0, 120)})`,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private async saveGenerationBestEffort(
    user: User,
    template: DocumentTemplate,
    formData: Record<string, string | number>,
    displayLabel: string,
  ): Promise<DocumentGeneration | null> {
    try {
      return await this.generationService.save(user, template, formData, displayLabel);
    } catch (e) {
      this.logger.warn(`Evrak arşiv kaydı atlandı: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  private async generateYillikPlanDocx(
    template: DocumentTemplate,
    user: User,
    formData: Record<string, string | number>,
  ): Promise<Buffer> {
    const base = this.buildMergeData(user, formData, template);
    const haftalar = await this.fetchHaftalarForMerge(template, formData, base, user);
    const zumreList = this.parseZumreOgretmenleri(formData, user, template); // [{isim}]

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || '';
    let subjectCode =
      template.subjectCode?.trim() ||
      str(formData.ders_kodu) ||
      str((formData as any).dersKodu) ||
      str((formData as any).subject_code) ||
      '';
    const isBilsemPlan =
      template.curriculumModel?.trim() === 'bilsem' || isBilsemSubjectCode(subjectCode);
    if (isBilsemPlan && !isBilsemSubjectCode(subjectCode)) {
      subjectCode =
        str(formData.ders_kodu) ||
        str((formData as any).dersKodu) ||
        str((formData as any).subject_code) ||
        'bilsem_cografya';
    }
    const bilsemPlanScopeForDoc = isBilsemPlan ? this.readBilsemPlanScopeFromForm(formData) : null;
    const gradeNum = base.sinif ? parseInt(String(base.sinif), 10) : template.grade ?? 9;
    const academicYear = base.ogretim_yili ?? '2024-2025';
    let tabloAltiNot: string | null = null;
    if (subjectCode) {
      if (isBilsemPlan) {
        const anaGrup = str(formData.ana_grup);
        if (anaGrup) {
          tabloAltiNot = await this.yillikPlanIcerikService.getMeta(
            subjectCode,
            anaGrup,
            academicYear,
            'bilsem',
            str(formData.alt_grup) || null,
          );
        }
      } else if (Number.isFinite(gradeNum)) {
        tabloAltiNot = await this.yillikPlanIcerikService.getMeta(subjectCode, gradeNum, academicYear);
      }
    }

    const schoolName = base.okul_adi ?? '';
    const grade = base.sinif ?? '';
    const dersAdi = base.ders_adi ?? template.subjectLabel ?? template.subjectCode ?? '';
    const ogretmenUnvani = base.ders_adi_ogretmeni ?? (dersAdi ? `${dersAdi} Öğretmeni` : 'Öğretmen');
    const mudurAdi = base.mudur_adi ?? '';
    const onayTarihiAlt = base.onay_tarihi_alt ?? '';

    /** MEB/Excel yıllık plan: AY… OKUL TEMELLİ ayrı sütun; FARK/OKUL başlığı yatay, satır başına içerik */
    const HEADER_ROW1: { text: string; columnSpan: number }[] = [
      { text: 'SÜRE', columnSpan: 2 },
      { text: 'DERS SAATİ · ÜNİTE/TEMA · KONU', columnSpan: 3 },
      { text: 'ÖĞRENME ÇIKTILARI / SÜREÇ BİLEŞENLERİ', columnSpan: 2 },
      { text: 'ÖLÇME VE DEĞERLENDİRME', columnSpan: 1 },
      { text: 'PROGRAMLAR ARASI BİLEŞENLER', columnSpan: 3 },
      { text: 'BELİRLİ GÜN VE HAFTALAR', columnSpan: 1 },
      { text: 'FARKLILAŞTIRMA', columnSpan: 1 },
      { text: 'OKUL TEMELLİ PLANLAMA', columnSpan: 1 },
    ];
    const topHeaderRow1 = HEADER_ROW1;
    // 2. satır — MEB xlsx şablonu (yiillik-plan-sablon) 2. satırla uyum; dar sütunlarda dikey
    const headersMeb = [
      'AY',
      'HAFTA',
      'DERS SAATİ',
      'ÜNİTE / TEMA',
      'KONU',
      'ÖĞRENME\nÇIKTILARI',
      'SÜREÇ\nBİLEŞENLERİ',
      'ÖLÇME / DEĞERLENDİRME',
      'SOSYAL-DUYG.\nÖĞR.',
      'DEĞERLER',
      'OKURYAZAR.\nBECERİ',
      'BELİRLİ GÜN\n/ HAFTA',
      'FARKLILAŞTIRMA',
      'OKUL TEM.\nPLANL.',
    ];
    const headersBilsem = [
      'AY',
      'HAFTA',
      'DERS SAATİ',
      'ÜNİTE / TEMA',
      'KONU',
      'ÖĞRENME\nÇIKTILARI',
      'SÜREÇ',
      'ÖLÇME / DEĞERLENDİRME',
      'SOSYAL-DUYG.\nÖĞR.',
      'DEĞERLER',
      'OKURYAZAR.\nBECERİ',
      'BELİRLİ GÜN\n/ HAFTA',
      'FARKLILAŞTIRMA',
      'OKUL TEM.\nPLANL.',
    ];
    const headers = isBilsemPlan ? headersBilsem : headersMeb;

    const CONTENT_KEYS = [
      'unite',
      'konu',
      'ogrenme_ciktilari',
      'surec_bilesenleri',
      'olcme_degerlendirme',
      'sosyal_duygusal',
      'degerler',
      'okuryazarlik_becerileri',
      'belirli_gun_haftalar',
      'zenginlestirme',
      'okul_temelli_planlama',
    ];

    const colWidthsBilsem = [
      240, 260, 220, 280, 360, 1000, 600, 2180, 400, 350, 420, 450, 380, 400,
    ];
    const colWidthsMeb = [
      300, 320, 280, 700, 860, 1300, 900, 1900, 520, 480, 560, 620, 700, 720,
    ];

    const normalizeAy = (s: string) => {
      const t = String(s ?? '').trim().replace(/\s+/g, ' ');
      if (!t) return '';
      const lower = t.toLocaleLowerCase('tr-TR');
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    };

    /** Yönetim paneli ile aynı metin: virgül/; ile otomatik bölme yok; sadece gerçek satır sonları. */
    const splitToLines = (raw: string): { lines: string[]; addBullets: boolean } => {
      const t = String(raw ?? '').trim();
      if (!t) return { lines: [], addBullets: false };
      const byNewline = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (byNewline.length > 1) return { lines: byNewline, addBullets: false };
      return { lines: [t], addBullets: false };
    };

    const EMPTY_PLACEHOLDER = '–';

    const weeksArr = (haftalar ?? []) as Record<string, unknown>[];
    let colWidthsMebLive = colWidthsMeb;
    let CELL_SIZE = 14;
    let CELL_SIZE_SMALL = 12;
    if (!isBilsemPlan && weeksArr.length) {
      const totalChars = weeksArr.reduce(
        (sum, h) =>
          sum +
          CONTENT_KEYS.reduce(
            (s, k) => s + String((h as Record<string, unknown>)[k] ?? '').length,
            0,
          ),
        0,
      );
      if (totalChars > 14000 || weeksArr.length > 36) {
        CELL_SIZE = 12;
        CELL_SIZE_SMALL = 10;
        colWidthsMebLive = colWidthsMeb.map((w, i) =>
          Math.max(i < 5 ? 200 : 180, Math.floor(w * (i <= 4 ? 0.9 : 0.94))),
        );
      } else if (totalChars > 8000) {
        CELL_SIZE_SMALL = 11;
        colWidthsMebLive = colWidthsMeb.map((w) => Math.max(220, Math.floor(w * 0.98)));
      }
    }
    const colWidths = isBilsemPlan ? colWidthsBilsem : colWidthsMebLive;

    const runsFromText = (raw: string, size: number) => {
      const { lines, addBullets } = splitToLines(raw);
      if (!lines.length) {
        return [new TextRun({ text: EMPTY_PLACEHOLDER, size, font: 'Calibri' })];
      }
      return lines.map((line, idx) => {
        const alreadyBullet = /^\s*[-•*]\s+/.test(line);
        const text = addBullets && !alreadyBullet ? `• ${line}` : line;
        return new TextRun({
          text,
          size,
          font: 'Calibri',
          break: idx === 0 ? 0 : 1,
        });
      });
    };

    /**
     * Sütun genişliğine göre en uzun kelimenin sığma durumundan punto seç.
     * Karakter sayısı yerine kelime bazlı: En uzun kelime sütuna sığıyorsa o font kullanılır.
     * Calibri ~12 karakter/inç; hücre kenar boşlukları ~400 twips.
     */
    const effectiveSizeForContent = (
      text: string,
      baseSize: number,
      colWidthTwips: number,
    ): number => {
      const { lines } = splitToLines(text);
      const words = lines.flatMap((l) => l.split(/\s+/).filter(Boolean));
      const maxWordLen = words.length ? Math.max(...words.map((w) => w.length)) : 0;
      if (maxWordLen === 0) return baseSize;
      const usableTwips = Math.max(200, colWidthTwips - 400);
      const charsPerInch = 12;
      const baseCpl = (usableTwips / 1440) * charsPerInch;
      const cpl10 = baseCpl;
      const cpl9 = baseCpl * (20 / 18);
      const cpl8 = baseCpl * (20 / 16);
      if (maxWordLen <= cpl10) return baseSize;
      if (maxWordLen <= cpl9) return 18; // 9pt
      return 16; // 8pt
    };

    /** Başlık metni: sütun genişliğine ve uzunluğa göre punto seç (min 7pt) */
    const effectiveSizeForHeader = (
      text: string,
      baseSize: number,
      colWidthTwips?: number,
    ): number => {
      const t = String(text ?? '').trim();
      if (!t) return baseSize;
      const maxLineLen = Math.max(...t.split(/\r?\n/).map((l) => l.length), t.length);
      if (colWidthTwips != null) {
        const usableTwips = Math.max(200, colWidthTwips - 400);
        const charsPerInch = 12;
        const cpl = (usableTwips / 1440) * charsPerInch;
        if (maxLineLen > cpl * 0.8) return 14; // 7pt – dar sütun
        if (maxLineLen > cpl * 0.6) return 16; // 8pt
        if (maxLineLen > cpl * 0.45) return 18; // 9pt
      }
      if (maxLineLen >= 25) return 14;
      if (maxLineLen >= 15) return 16;
      if (maxLineLen >= 8) return 18;
      return baseSize;
    };

    /** Dikey gövde metnini en fazla 2 satıra böl; kısaltma yok, tüm metin korunur. */
    const wrapForVerticalBody = (raw: string, colWidthTwips: number): string => {
      const t = String(raw ?? '').replace(/\s+/g, ' ').trim();
      if (!t) return t;
      const target = Math.max(10, Math.floor(t.length / 2));
      let splitAt = -1;
      for (let i = target; i >= 1; i--) {
        if (t[i] === ' ') {
          splitAt = i;
          break;
        }
      }
      if (splitAt < 0) {
        for (let i = target + 1; i < t.length - 1; i++) {
          if (t[i] === ' ') {
            splitAt = i;
            break;
          }
        }
      }
      if (splitAt < 0) {
        const forceAt = Math.max(1, Math.min(t.length - 1, Math.floor(colWidthTwips / 82)));
        return `${t.slice(0, forceAt)}\n${t.slice(forceAt)}`;
      }
      return `${t.slice(0, splitAt).trim()}\n${t.slice(splitAt + 1).trim()}`;
    };

    const createCell = (
      text: string,
      opts?: {
        bold?: boolean;
        align?: any;
        size?: number;
        shading?: string;
        vAlign?: any;
        listify?: boolean;
        autoShrink?: boolean;
        autoShrinkHeader?: boolean;
        colWidthTwips?: number;
        textDirection?: (typeof TextDirection)[keyof typeof TextDirection];
        borders?: Partial<{ left: { style: any; size: number; color: string } }>;
        columnSpan?: number;
        margins?: { top?: number; bottom?: number; left?: number; right?: number };
        verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
      },
    ) => {
      const baseSize = opts?.size ?? 20;
      const size = opts?.autoShrinkHeader
        ? effectiveSizeForHeader(text, baseSize, opts?.colWidthTwips)
        : opts?.autoShrink && opts?.colWidthTwips != null
          ? effectiveSizeForContent(text, baseSize, opts.colWidthTwips)
          : baseSize;
      const isVertical = !!opts?.textDirection;
      const vmContinue = opts?.verticalMerge === VerticalMergeType.CONTINUE;
      return new TableCell({
        columnSpan: opts?.columnSpan,
        textDirection: opts?.textDirection,
        verticalMerge: opts?.verticalMerge,
        children: [
          new Paragraph({
            children: vmContinue
              ? [new TextRun({ text: ' ', size: 2, font: 'Calibri' })]
              : [
                  ...(
                    opts?.listify
                    ? runsFromText(text, size).map((r) => {
                        (r as any).bold = opts?.bold ?? false;
                        return r;
                      })
                    : [
                        new TextRun({
                          text: (text ?? '').trim() || EMPTY_PLACEHOLDER,
                          bold: opts?.bold ?? false,
                          size,
                          font: 'Calibri',
                        }),
                      ]
                  ),
                ],
            alignment: opts?.align ?? AlignmentType.LEFT,
            spacing: {
              after: 0,
              before: 0,
              line: isVertical ? 220 : 200,
              lineRule: (isVertical ? 'exactly' : 'atLeast') as any,
            },
          }),
        ],
        shading: opts?.shading ? { fill: opts.shading } : undefined,
        verticalAlign: opts?.vAlign ?? VerticalAlign.CENTER,
        margins: opts?.margins ?? { top: 80, bottom: 80, left: 80, right: 80 },
        borders: opts?.borders,
      });
    };

    const header1StartCols = [0, 2, 5, 7, 8, 11, 12, 13];
    const headerRow1 = new TableRow({
      tableHeader: false,
      cantSplit: true,
      children: topHeaderRow1.map((item, i) => {
        const start = header1StartCols[i];
        const colW = colWidths.slice(start, start + item.columnSpan).reduce((a, b) => a + b, 0);
        return createCell(item.text.replace(/\n/g, ' '), {
          bold: true,
          align: AlignmentType.CENTER,
          shading: TABLE_STYLES.LIGHT_GREEN,
          size: HEADER_STYLES.HEADER_SIZE,
          vAlign: VerticalAlign.CENTER,
          columnSpan: item.columnSpan,
          margins: HEADER_STYLES.HEADER_MARGINS,
          colWidthTwips: colW,
          autoShrinkHeader: true,
        });
      }),
      height: { value: 320, rule: 'atLeast' as any },
    });
    const headerRow2 = new TableRow({
      tableHeader: false,
      cantSplit: true,
      children: headers.map((h, i) => {
        const isWideCol = i >= 5 && i < 8;
        const isTightMargins = i < 5 || i === 6 || (i >= 8 && i <= 13);
        const useVerticalHeader = i <= 4 || (i >= 8 && i <= 13);
        return createCell(h.replace(/\n/g, ' '), {
          bold: true,
          align: AlignmentType.CENTER,
          shading: TABLE_STYLES.LIGHT_GRAY,
          size: isTightMargins && !isWideCol ? 14 : HEADER_STYLES.HEADER_SIZE,
          vAlign: VerticalAlign.CENTER,
          margins: isTightMargins ? { top: 25, bottom: 25, left: 25, right: 25 } : HEADER_STYLES.HEADER_MARGINS,
          colWidthTwips: colWidths[i],
          ...(useVerticalHeader && { textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT }),
          ...(isWideCol && { autoShrinkHeader: true }),
        });
      }),
      height: { value: 420, rule: 'atLeast' as any },
    });

    const rowHeightFromContent = (h: Record<string, unknown>): number => {
      const totalChars = CONTENT_KEYS.reduce((sum, k) => sum + String(h?.[k] ?? '').length, 0);
      const lineCount = CONTENT_KEYS.reduce(
        (sum, k) => sum + splitToLines(String(h?.[k] ?? '')).lines.length,
        0,
      );
      const score = totalChars + lineCount * 20;
      let base = 450;
      if (score > 800) base = 700;
      else if (score > 500) base = 560;
      else if (score > 250) base = 500;
      const shortVerticalKeys = ['ay', 'hafta_label', 'ders_saati'];
      const maxShort = Math.max(0, ...shortVerticalKeys.map((k) => String(h?.[k] ?? '').length));
      const verticalNeed = Math.min(420, maxShort * 44);
      return Math.min(2200, Math.max(base, verticalNeed));
    };

    const VERTICAL_TEXT = TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT; // dikey yukarı
    const MERGED_FARK_OKUL_SHADE = 'F3F4F6';
    const singlePlanCol = (key: 'zenginlestirme' | 'okul_temelli_planlama'): string => {
      for (const row of weeksArr) {
        const v = String((row as any)?.[key] ?? '').trim();
        if (v) return v;
      }
      return '';
    };
    const aggZenginlestirme = singlePlanCol('zenginlestirme');
    const aggOkulTemelli = singlePlanCol('okul_temelli_planlama');
    const useMergedRightCols = isBilsemPlan;
    const mebDonemVertMerge = !isBilsemPlan;
    const mebGroupAtRowIdx = (idx: number): 1 | 2 => {
      const wo = Number((weeksArr[idx] as any)?.week_order ?? 0);
      return wo >= 19 ? 2 : 1;
    };
    const mebIdxByDonem: [number[], number[]] = [[], []];
    for (let ix = 0; ix < weeksArr.length; ix++) {
      mebIdxByDonem[mebGroupAtRowIdx(ix) - 1].push(ix);
    }
    const mebBuildDonemAgg = (donemIx: 0 | 1, key: 'zenginlestirme' | 'okul_temelli_planlama'): string => {
      for (const idx of mebIdxByDonem[donemIx]) {
        const r = weeksArr[idx] as any;
        const v = String(r[key] ?? '').trim();
        if (v) return v;
      }
      return EMPTY_PLACEHOLDER;
    };
    const mebDonemZ: [string, string] = [
      mebBuildDonemAgg(0, 'zenginlestirme'),
      mebBuildDonemAgg(1, 'zenginlestirme'),
    ];
    const mebDonemO: [string, string] = [
      mebBuildDonemAgg(0, 'okul_temelli_planlama'),
      mebBuildDonemAgg(1, 'okul_temelli_planlama'),
    ];

    const dataRows = weeksArr.map((h, rowIdx) => {
      const get = (k: string) => String((h as any)?.[k] ?? '');
      const ay = normalizeAy(get('ay'));
      const isSpecial = !!(h as any)?.is_special;
      const rowShade = isSpecial ? TABLE_STYLES.SPECIAL_ROW_SHADE : (rowIdx % 2 === 1 ? 'F8FAFC' : undefined);
      const rowHeight = rowHeightFromContent(h as Record<string, unknown>);
      const vCenter = VerticalAlign.CENTER;
      const bodyCellOpts = {
        vAlign: vCenter,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
      };
      const vmFirst = rowIdx === 0 ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;
      const zMerged = rowIdx === 0 ? (aggZenginlestirme.trim() || EMPTY_PLACEHOLDER) : '';
      const oMerged = rowIdx === 0 ? (aggOkulTemelli.trim() || EMPTY_PLACEHOLDER) : '';
      const zPerRow = get('zenginlestirme').trim() || EMPTY_PLACEHOLDER;
      const oPerRow = get('okul_temelli_planlama').trim() || EMPTY_PLACEHOLDER;
      const mebG = mebDonemVertMerge ? mebGroupAtRowIdx(rowIdx) : 1;
      const mebFirstDonem =
        !mebDonemVertMerge || rowIdx === 0 || mebGroupAtRowIdx(rowIdx - 1) !== mebG;
      const zVm = useMergedRightCols
        ? vmFirst
        : mebDonemVertMerge
          ? mebFirstDonem
            ? VerticalMergeType.RESTART
            : VerticalMergeType.CONTINUE
          : undefined;
      const oVm = zVm;
      const zDisplay = useMergedRightCols
        ? zMerged
        : mebDonemVertMerge
          ? mebFirstDonem
            ? mebDonemZ[mebG - 1]
            : ''
          : zPerRow;
      const oDisplay = useMergedRightCols
        ? oMerged
        : mebDonemVertMerge
          ? mebFirstDonem
            ? mebDonemO[mebG - 1]
            : ''
          : oPerRow;
      const zListify = useMergedRightCols
        ? rowIdx === 0 && /\n/.test(aggZenginlestirme)
        : mebDonemVertMerge
          ? mebFirstDonem && /\n/.test(mebDonemZ[mebG - 1])
          : /\n/.test(zPerRow);
      const oListify = useMergedRightCols
        ? rowIdx === 0 && /\n/.test(aggOkulTemelli)
        : mebDonemVertMerge
          ? mebFirstDonem && /\n/.test(mebDonemO[mebG - 1])
          : /\n/.test(oPerRow);
      const zAutoShrink = useMergedRightCols ? rowIdx === 0 : mebDonemVertMerge ? mebFirstDonem : true;
      const oAutoShrink = zAutoShrink;

      /** Bilsem: tatil/özel haftada orta blok tek hücrede; MEB her zaman 14 sütun (sarı yalnızca is_special satırında). */
      if (isSpecial && isBilsemPlan) {
        const specialText = Array.from(
          new Set(
            [
              get('tatil_label'),
              get('konu'),
              get('belirli_gun_haftalar'),
              get('sosyal_duygusal'),
              get('ogrenme_ciktilari'),
            ]
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ).join('\n');
        const mergedSpecial = specialText || 'Tatil / Özel hafta';
        const midWidth = colWidths.slice(5, 12).reduce((a, b) => a + b, 0);
        return new TableRow({
          cantSplit: true,
          children: [
            createCell(ay, { align: AlignmentType.CENTER, size: CELL_SIZE, shading: rowShade, bold: true, ...bodyCellOpts, colWidthTwips: colWidths[0], borders: { left: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: 'D97706' } } }),
            createCell(get('hafta_label'), { align: AlignmentType.CENTER, size: CELL_SIZE, shading: rowShade, bold: true, ...bodyCellOpts, colWidthTwips: colWidths[1] }),
            createCell(get('ders_saati'), { align: AlignmentType.CENTER, size: CELL_SIZE, shading: rowShade, ...bodyCellOpts, colWidthTwips: colWidths[2] }),
            createCell(get('unite'), {
              align: AlignmentType.CENTER,
              vAlign: vCenter,
              size: CELL_SIZE,
              shading: rowShade,
              colWidthTwips: colWidths[3],
              autoShrink: true,
            }),
            createCell(get('konu') || get('tatil_label'), {
              align: AlignmentType.CENTER,
              vAlign: vCenter,
              listify: false,
              size: CELL_SIZE,
              shading: rowShade,
              bold: true,
              colWidthTwips: colWidths[4],
              autoShrink: true,
            }),
            createCell(mergedSpecial, {
              columnSpan: 7,
              align: AlignmentType.CENTER,
              vAlign: vCenter,
              listify: true,
              bold: true,
              size: CELL_SIZE_SMALL,
              shading: rowShade,
              colWidthTwips: midWidth,
              autoShrink: true,
            }),
            createCell(zDisplay, {
              verticalMerge: zVm,
              align: AlignmentType.CENTER,
              size: CELL_SIZE_SMALL,
              shading: MERGED_FARK_OKUL_SHADE,
              colWidthTwips: colWidths[12],
              listify: zListify,
              autoShrink: zAutoShrink,
              ...bodyCellOpts,
            }),
            createCell(oDisplay, {
              verticalMerge: oVm,
              align: AlignmentType.CENTER,
              size: CELL_SIZE_SMALL,
              shading: MERGED_FARK_OKUL_SHADE,
              colWidthTwips: colWidths[13],
              listify: oListify,
              autoShrink: oAutoShrink,
              ...bodyCellOpts,
            }),
          ],
          height: { value: Math.max(rowHeight, 520), rule: 'atLeast' as any },
        });
      }

      return new TableRow({
        cantSplit: true,
        children: [
          createCell(ay, { align: AlignmentType.CENTER, size: CELL_SIZE, shading: rowShade, bold: true, ...bodyCellOpts, colWidthTwips: colWidths[0], borders: isSpecial ? { left: { style: BorderStyle.SINGLE, size: TABLE_STYLES.BORDER_SIZE, color: 'D97706' } } : undefined }),
          createCell(get('hafta_label'), { align: AlignmentType.CENTER, size: CELL_SIZE, shading: rowShade, bold: true, ...bodyCellOpts, colWidthTwips: colWidths[1] }),
          createCell(get('ders_saati'), { align: AlignmentType.CENTER, size: CELL_SIZE, shading: rowShade, ...bodyCellOpts, colWidthTwips: colWidths[2] }),
          createCell(get('unite'), {
            align: AlignmentType.CENTER,
            vAlign: vCenter,
            size: CELL_SIZE,
            shading: rowShade,
            colWidthTwips: colWidths[3],
            autoShrink: true,
          }),
          createCell(get('konu'), {
            align: AlignmentType.CENTER,
            vAlign: vCenter,
            listify: false,
            size: CELL_SIZE,
            shading: rowShade,
            colWidthTwips: colWidths[4],
            autoShrink: true,
          }),
          createCell(get('ogrenme_ciktilari'), { vAlign: vCenter, listify: false, size: CELL_SIZE_SMALL, shading: rowShade, colWidthTwips: colWidths[5], autoShrink: true }),
          createCell(get('surec_bilesenleri'), {
            align: AlignmentType.CENTER,
            vAlign: vCenter,
            listify: false,
            size: CELL_SIZE_SMALL,
            shading: rowShade,
            colWidthTwips: colWidths[6],
            autoShrink: true,
          }),
          createCell(get('olcme_degerlendirme'), { vAlign: vCenter, listify: false, size: 10, shading: rowShade, colWidthTwips: colWidths[7], autoShrink: true }),
          createCell(wrapForVerticalBody(get('sosyal_duygusal'), colWidths[8]), {
            align: AlignmentType.CENTER,
            size: CELL_SIZE_SMALL,
            shading: rowShade,
            colWidthTwips: colWidths[8],
            autoShrink: true,
            textDirection: VERTICAL_TEXT,
            listify: true,
            ...bodyCellOpts,
          }),
          createCell(wrapForVerticalBody(get('degerler'), colWidths[9]), {
            align: AlignmentType.CENTER,
            size: CELL_SIZE_SMALL,
            shading: rowShade,
            colWidthTwips: colWidths[9],
            autoShrink: true,
            textDirection: VERTICAL_TEXT,
            listify: true,
            ...bodyCellOpts,
          }),
          createCell(wrapForVerticalBody(get('okuryazarlik_becerileri'), colWidths[10]), {
            align: AlignmentType.CENTER,
            size: CELL_SIZE_SMALL,
            shading: rowShade,
            colWidthTwips: colWidths[10],
            autoShrink: true,
            textDirection: VERTICAL_TEXT,
            listify: true,
            ...bodyCellOpts,
          }),
          createCell(get('belirli_gun_haftalar'), {
            align: AlignmentType.CENTER,
            size: CELL_SIZE_SMALL,
            shading: rowShade,
            colWidthTwips: colWidths[11],
            autoShrink: true,
            ...bodyCellOpts,
          }),
          createCell(zDisplay, {
            verticalMerge: zVm,
            align: AlignmentType.CENTER,
            size: CELL_SIZE_SMALL,
            shading: MERGED_FARK_OKUL_SHADE,
            colWidthTwips: colWidths[12],
            listify: zListify,
            autoShrink: zAutoShrink,
            ...bodyCellOpts,
          }),
          createCell(oDisplay, {
            verticalMerge: oVm,
            align: AlignmentType.CENTER,
            size: CELL_SIZE_SMALL,
            shading: MERGED_FARK_OKUL_SHADE,
            colWidthTwips: colWidths[13],
            listify: oListify,
            autoShrink: oAutoShrink,
            ...bodyCellOpts,
          }),
        ],
        height: { value: rowHeight, rule: 'atLeast' as any },
      });
    });

    // ornek-yillik-plan-modern ile aynı: siyah kenarlıklar
    const tableBorders = {
      top: { style: BorderStyle.SINGLE, size: 8, color: '000000' as const },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' as const },
      left: { style: BorderStyle.SINGLE, size: 8, color: '000000' as const },
      right: { style: BorderStyle.SINGLE, size: 8, color: '000000' as const },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' as const },
      insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' as const },
    };

    const planTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: colWidths,
      rows: [...(dataRows.length ? [headerRow1, headerRow2, ...dataRows] : [headerRow1, headerRow2])],
      borders: tableBorders,
    });

    const mudurNorm = String(mudurAdi ?? '').trim().toLocaleLowerCase('tr-TR');
    const teacherItems = (zumreList ?? []).filter((z) => {
      const isimNorm = String(z?.isim ?? '').trim().toLocaleLowerCase('tr-TR');
      if (!isimNorm) return false;
      if (mudurNorm && isimNorm === mudurNorm) return false;
      return true;
    });
    const teacherItemsSafe = teacherItems.length
      ? teacherItems
      : [{ isim: '', unvan: undefined as string | undefined }];
    const teacherCount = Math.max(teacherItemsSafe.length, 1);
    const principalColWidth = 3500;
    const totalWidth = 10000;
    const teacherColWidth = Math.max(1200, Math.floor((totalWidth - principalColWidth) / teacherCount));
    const approvalColWidths = [...Array(teacherCount).fill(teacherColWidth), principalColWidth];

    const teacherCells = teacherItemsSafe.map((z) => {
      const unvanText = (z.unvan?.trim() || ogretmenUnvani) || 'Öğretmen';
      return new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: z.isim || '', size: 20, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: unvanText, size: 20, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
          }),
        ],
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 200, bottom: 200, left: 100, right: 100 },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
      });
    });

    // Eğer teacherCount > teacherNames.length (teacherNames boştu), 1 hücre oluşturduk zaten.
    while (teacherCells.length < teacherCount) {
      teacherCells.push(
        new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: '', size: 20, font: 'Calibri' })] }),
          ],
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
        }),
      );
    }

    const principalCell = new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: onayTarihiAlt, size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'UYGUNDUR', bold: true, size: 24, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: mudurAdi, size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Okul Müdürü', size: 20, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 200, bottom: 200, left: 100, right: 100 },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
    });

    const approvalTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: approvalColWidths,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [...teacherCells.slice(0, teacherCount), principalCell],
        }),
      ],
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
    });

    const ustSatir1 = isBilsemPlan
      ? `${schoolName} ${academicYear} EĞİTİM-ÖĞRETİM YILI ${grade} GRUP`.replace(/\s+/g, ' ').trim()
      : `${schoolName} ${academicYear} EĞİTİM-ÖĞRETİM YILI ${grade}. SINIF`;
    const sectionChildren: (Paragraph | Table)[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: ustSatir1,
            bold: true,
            size: 20,
            font: 'Calibri',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: (() => {
              if (!isBilsemPlan) return `${dersAdi} DERSİ ÜNİTELENDİRİLMİŞ YILLIK DERS PLANI`;
              if (bilsemPlanScopeForDoc === 'donem_1') return `${dersAdi} DERSİ 1. DÖNEM ÜNİTELENDİRİLMİŞ DERS PLANI`;
              if (bilsemPlanScopeForDoc === 'donem_2') return `${dersAdi} DERSİ 2. DÖNEM ÜNİTELENDİRİLMİŞ DERS PLANI`;
              return `${dersAdi} DERSİ ÜNİTELENDİRİLMİŞ YILLIK DERS PLANI`;
            })(),
            bold: true,
            size: 20,
            font: 'Calibri',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
    ];

    sectionChildren.push(planTable);

    sectionChildren.push(new Paragraph({ spacing: { after: 220 } }), approvalTable);

    if (tabloAltiNot?.trim()) {
      sectionChildren.push(
        new Paragraph({ spacing: { before: 180, after: 0 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: tabloAltiNot.trim(),
              size: 14,
              font: 'Calibri',
            }),
          ],
          alignment: AlignmentType.LEFT,
        }),
      );
    }

    const doc = new DocxDocument({
      hyphenation: { autoHyphenation: true },
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 11906,
                height: 16838,
                orientation: PageOrientation.LANDSCAPE,
              },
              margin: {
                top: convertInchesToTwip(0.35),
                right: convertInchesToTwip(0.3),
                bottom: convertInchesToTwip(0.35),
                left: convertInchesToTwip(0.3),
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      children: ['Sayfa ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                      size: 18,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          },
          children: sectionChildren,
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  /**
   * Merge sonucunu önizleme için döndürür.
   * xlsx için: sheet_to_html (merged cells colspan/rowspan ile) + preview_url.
   */
  async preview(
    dto: GenerateDocumentDto,
    user: User,
  ): Promise<
    | {
        format: 'xlsx';
        sheet_name: string;
        sheet_html: string;
        preview_url?: string;
      }
    | { format: 'docx'; preview_available: false; message: string }
  > {
    const template = await this.templateRepo.findOne({
      where: { id: dto.template_id },
    });
    if (!template) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Şablon bulunamadı.',
      });
    }
    if (!template.isActive || !template.requiresMerge) {
      throw new BadRequestException({
        code: 'NO_PREVIEW',
        message: 'Bu şablon için önizleme kullanılamıyor.',
      });
    }
    const format = template.fileFormat || 'docx';
    const formData = dto.form_data ?? {};
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // Yıllık plan DOCX: tüm plan tablosu + imza bloğu – küçük önizleme
    if (template.type === 'yillik_plan' && format === 'docx') {
      const base = this.buildMergeData(user, formData, template);
      const haftalar = await this.fetchHaftalarForMerge(template, formData, base, user);
      const zumreList = this.parseZumreOgretmenleri(formData, user, template);
      const ogretmenUnvani = base.ders_adi_ogretmeni ?? 'Öğretmen';
      const okulAdi = base.okul_adi ?? '';
      const mudurAdi = base.mudur_adi ?? '';
      const onayTarihiAlt = base.onay_tarihi_alt ?? '';
      const dersAdiPrev = (base.ders_adi ?? '').trim();
      const isBilsemT =
        template.curriculumModel?.trim() === 'bilsem' ||
        (String((formData as Record<string, unknown>).ders_kodu ?? (formData as any).subject_code ?? '')
          .toLowerCase()
          .startsWith('bilsem_'));
      const planTitleLine = isBilsemT
        ? (formData as any).scope === 'donem_1'
          ? '1. dönem plan önizlemesi'
          : (formData as any).scope === 'donem_2'
            ? '2. dönem plan önizlemesi'
            : 'Yıllık plan önizlemesi'
        : 'Plan önizlemesi';

      const strPv = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || '';
      if (isBilsemT) {
        const dk =
          strPv((formData as Record<string, unknown>).ders_kodu) ||
          strPv((formData as Record<string, unknown>).dersKodu) ||
          strPv((formData as Record<string, unknown>).subject_code) ||
          '';
        const ana = strPv((formData as Record<string, unknown>).ana_grup);
        const yil = String(base.ogretim_yili ?? '').trim();
        const altRaw = strPv((formData as Record<string, unknown>).alt_grup);
        if (dk && ana && yil) {
          // Attribution line removed
        }
      }

      const cols = [
        'ay',
        'hafta_label',
        'ders_saati',
        'unite',
        'konu',
        'ogrenme_ciktilari',
        'surec_bilesenleri',
        'olcme_degerlendirme',
        'sosyal_duygusal',
        'degerler',
        'okuryazarlik_becerileri',
        'belirli_gun_haftalar',
        'zenginlestirme',
        'okul_temelli_planlama',
      ];
      const colLabels = [
        'Ay',
        'Hafta',
        'Ders saati',
        'Ünite / tema',
        'Konu',
        'Öğrenme çıktıları',
        'Süreç',
        'Ölçme / değ.',
        'Sos.-duyg.',
        'Değerler',
        'Okuryaz.',
        'Bel. gün/hafta',
        'Farklıl.',
        'Okul tem.',
      ];
      const thStyle = 'border:1px solid #d1d5db;padding:2px 4px;background:#e8ecf0;text-align:left;font-size:9px;white-space:nowrap;';
      const tdStyle = 'border:1px solid #d1d5db;padding:1px 4px;vertical-align:top;font-size:9px;max-width:12rem;';
      let html = '<div style="font-size:10px;font-family:sans-serif;">';
      if (dersAdiPrev || base.ogretim_yili) {
        html += `<p style="margin:0 0 6px 0;font-weight:600;font-size:11px;">${escapeHtml(dersAdiPrev || 'Ders')}${base.ogretim_yili ? ` · ${escapeHtml(base.ogretim_yili)}` : ''}</p>`;
      }
      html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">';
      html += '<table style="min-width:1100px;width:100%;border-collapse:collapse;"><thead><tr>';
      colLabels.forEach((l) => {
        html += `<th style="${thStyle}">${escapeHtml(l)}</th>`;
      });
      html += '</tr></thead><tbody>';
      (haftalar ?? []).forEach((h) => {
        html += '<tr>';
        cols.forEach((c) => {
          const v = String((h as Record<string, unknown>)?.[c] ?? '');
          const tdBg =
            (h as Record<string, unknown>).is_tatil || (h as Record<string, unknown>).is_special
              ? `${tdStyle}background:#fef3c7;`
              : tdStyle;
          html += `<td style="${tdBg}">${escapeHtml(v)}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      if ((haftalar ?? []).length === 0) {
        html += '<p style="padding:12px;color:#6b7280;font-size:11px;">Plan içeriği henüz yok.</p>';
      }
      html += '<div style="margin-top:16px;padding-top:12px;border-top:1px solid #d1d5db;">';
      html += '<p style="font-weight:600;margin-bottom:8px;font-size:10px;">İmza bölümü</p>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:12px;">';
      zumreList.forEach((z) => {
        const unvan = (z.unvan?.trim() || ogretmenUnvani) || 'Öğretmen';
        html += `<div style="border:1px solid #e5e7eb;border-radius:4px;padding:8px;min-width:90px;"><div style="font-weight:500;">${escapeHtml(z.isim || '')}</div><div style="color:#6b7280;font-size:9px;">${escapeHtml(unvan)}</div></div>`;
      });
      if (zumreList.length === 0) {
        html += '<div style="border:1px solid #e5e7eb;border-radius:4px;padding:8px;"><div style="font-weight:500;">—</div><div style="color:#6b7280;">Öğretmen</div></div>';
      }
      html += `<div style="border:1px solid #e5e7eb;border-radius:4px;padding:8px;min-width:90px;"><div>${escapeHtml(onayTarihiAlt)}</div><div style="font-weight:700;">UYGUNDUR</div><div style="font-weight:500;">${escapeHtml(mudurAdi)}</div><div style="color:#6b7280;font-size:9px;">Okul Müdürü</div></div>`;
      html += '</div></div>';
      html += '</div>';

      return {
        format: 'docx',
        sheet_name: okulAdi ? `${escapeHtml(okulAdi)} · Plan önizleme` : 'Plan önizleme',
        sheet_html: html,
        preview_available: true,
        full_plan: true,
      } as any;
    }

    if (format !== 'xlsx') {
      return {
        format: 'docx',
        preview_available: false,
        message: 'Önizleme sadece Excel (.xlsx) formatı için desteklenmektedir.',
      };
    }

    let templateBuffer: Buffer;
    try {
      templateBuffer = await this.loadTemplateBuffer(
        template.fileUrl,
        template.fileUrlLocal,
      );
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : '';
      const code =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name?: string }).name)
          : '';
      if (
        code === 'NoSuchKey' ||
        msg.includes('NoSuchKey') ||
        msg.includes('The specified key does not exist') ||
        msg.includes('does not exist')
      ) {
        throw new BadRequestException({
          code: 'TEMPLATE_NOT_FOUND',
          message: `Şablon dosyası R2’de bulunamadı. Coğrafya vb. şablonlar yüklenmiş olmalı. Yol: ${template.fileUrl}`,
        });
      }
      if (msg.includes('R2_NOT_CONFIGURED') || msg.includes('R2 ayarları')) {
        throw new BadRequestException({
          code: 'R2_NOT_CONFIGURED',
          message:
            'R2 depolama yapılandırılmamış. Superadmin Ayarlar → Depolama bölümünden R2 ayarlarını girin.',
        });
      }
      throw err;
    }

    const mergeData = this.buildMergeData(user, dto.form_data ?? {}, template);
    const outputBuffer = this.mergeXlsx(templateBuffer, mergeData);

    const workbook = XLSX.read(outputBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    if (!sheet || !sheet['!ref']) {
      return {
        format: 'xlsx',
        sheet_name: firstSheetName,
        sheet_html:
          '<table class="preview-table"><tbody><tr><td class="text-muted-foreground p-4">Sayfa verisi bulunamadı. Şablon boş veya format beklenenden farklı olabilir.</td></tr></tbody></table>',
        preview_url: undefined,
      };
    }

    const sheetHtml = XLSX.utils.sheet_to_html(sheet, {
      id: 'evrak-preview-table',
      editable: false,
      header: '',
      footer: '',
    });

    let previewUrl: string | undefined;
    try {
      const key = `generated/preview/${uuidv4()}.xlsx`;
      const contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      await this.uploadService.uploadBuffer(key, outputBuffer, contentType);
      previewUrl = await this.uploadService.getSignedDownloadUrl(key, 900); // 15 dk
    } catch {
      previewUrl = undefined;
    }

    return {
      format: 'xlsx',
      sheet_name: firstSheetName,
      sheet_html: sheetHtml,
      preview_url: previewUrl,
    };
  }

  /** Görüntüleme etiketi: MEB "9. Sınıf · …"; Bilsem "ana/alt grup · …" (sınıf değil grup). */
  private buildDisplayLabel(
    template: DocumentTemplate,
    mergeData: Record<string, string>,
  ): string {
    const sinifRaw = mergeData.sinif ?? (template.grade != null ? String(template.grade) : '');
    const sinif = String(sinifRaw).trim();
    const ders = mergeData.ders_adi ?? template.subjectLabel ?? template.subjectCode ?? '';
    const yil = mergeData.ogretim_yili ?? '';
    const isBilsem = this.isBilsemPlanTemplate(template);
    const parts = isBilsem
      ? [sinif, ders, yil].filter((p) => String(p).trim())
      : [sinif ? `${sinif}. Sınıf` : '', ders, yil].filter(Boolean);
    return parts.join(' · ') || 'Yıllık Plan';
  }

  private isBilsemPlanTemplate(template: DocumentTemplate): boolean {
    return (
      template.curriculumModel?.trim() === 'bilsem' || isBilsemSubjectCode(template.subjectCode ?? '')
    );
  }

  /** Okunabilir dosya adı: örn. 9-Sinif-Cografya-Yillik-Plan-2024-2025.xlsx */
  private buildDownloadFilename(
    template: DocumentTemplate,
    mergeData: Record<string, string>,
    ext: string,
  ): string {
    const sanitize = (s: string) =>
      String(s)
        .replace(/[^\w\u00C0-\u024F\s.-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'evrak';

    const ders = sanitize(mergeData.ders_adi ?? template.subjectLabel ?? template.subjectCode ?? '');
    const sinif = String(mergeData.sinif ?? (template.grade != null ? String(template.grade) : '')).trim();
    const yil = sanitize(mergeData.ogretim_yili ?? '');
    const typeLabel =
      template.type === 'yillik_plan'
        ? 'Yillik-Plan'
        : template.type === 'gunluk_plan'
          ? 'Gunluk-Plan'
          : template.type === 'zumre'
            ? 'Zumre'
            : template.type;

    if (template.type === 'yillik_plan' && ders) {
      const isBilsem = this.isBilsemPlanTemplate(template);
      const parts = sinif
        ? isBilsem
          ? [sanitize(sinif), ders]
          : [`${sinif}-Sinif`, ders]
        : [ders];
      return `${parts.join('-')}-${typeLabel}${yil ? `-${yil}` : ''}.${ext}`;
    }
    if (template.type === 'zumre' && ders) {
      return `${ders}-${typeLabel}${yil ? `-${yil}` : ''}.${ext}`;
    }
    return `${typeLabel}-${sanitize(ders || 'evrak')}${yil ? `-${yil}` : ''}.${ext}`;
  }

  private validateFormData(
    template: DocumentTemplate,
    formData: Record<string, string | number>,
  ): void {
    const schema = template.formSchema ?? [];
    if (!Array.isArray(schema)) return;
    for (const field of schema) {
      const item = field as { key?: string; label?: string; required?: boolean };
      if (!item.required || !item.key) continue;
      const val = formData[item.key];
      const str = typeof val === 'string' ? val.trim() : val != null ? String(val).trim() : '';
      if (!str) {
        throw new BadRequestException({
          code: 'FORM_VALIDATION',
          message: `Zorunlu alan eksik: ${item.label ?? item.key}`,
        });
      }
    }
  }

  private async loadTemplateBuffer(
    fileUrl: string,
    fallbackUrl?: string | null,
  ): Promise<Buffer> {
    const FETCH_TIMEOUT_MS = 15000;

    const load = async (url: string): Promise<Buffer> => {
      if (url.startsWith('local:')) {
        const filename = url.slice(6).trim() || 'veli-toplanti-tutanak.docx';
        const templatesDir = path.join(process.cwd(), 'templates');
        const filePath = path.join(templatesDir, filename);
        if (!fs.existsSync(filePath)) {
          throw new BadRequestException({
            code: 'TEMPLATE_NOT_FOUND',
            message: `Yerel şablon bulunamadı: ${filename}`,
          });
        }
        return fs.readFileSync(filePath);
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) {
            throw new BadRequestException({
              code: 'TEMPLATE_FETCH_FAILED',
              message: 'Şablon dosyası alınamadı.',
            });
          }
          const ab = await res.arrayBuffer();
          return Buffer.from(ab);
        } catch (e) {
          clearTimeout(timeoutId);
          if (e instanceof BadRequestException) throw e;
          if (e instanceof Error && e.name === 'AbortError') {
            throw new BadRequestException({
              code: 'TEMPLATE_FETCH_TIMEOUT',
              message: 'Şablon dosyası zaman aşımına uğradı. R2 veya ağ bağlantısını kontrol edin.',
            });
          }
          throw e;
        }
      }
      return this.uploadService.getObjectBuffer(url);
    };

    // local: fallback varsa ve dosya mevcutsa önce onu dene (merge için placeholder'lar yerelde)
    const fallback = fallbackUrl?.trim();
    if (fallback?.startsWith('local:')) {
      const filename = fallback.slice(6).trim() || 'veli-toplanti-tutanak.docx';
      const filePath = path.join(process.cwd(), 'templates', filename);
      if (fs.existsSync(filePath)) {
        try {
          return fs.readFileSync(filePath);
        } catch {
          /* aşağıdaki fileUrl denenir */
        }
      }
    }

    try {
      return await load(fileUrl);
    } catch (err) {
      if (fallback) {
        try {
          return await load(fallback);
        } catch {
          throw new BadRequestException({
            code: 'TEMPLATE_NOT_FOUND',
            message:
              'Şablon dosyası bulunamadı (R2 ve yerel yol). R2\'ye yükleyin veya backend/templates/ altına yerel dosya ekleyin.',
          });
        }
      }
      throw err;
    }
  }

  private buildMergeData(
    user: User,
    formData: Record<string, string | number>,
    template?: DocumentTemplate,
  ): Record<string, string> {
    const school = user.school;
    const defaults = user.evrakDefaults ?? {};
    const academicYears = getAcademicYearOptions();

    // Öncelik: form_data > evrak_defaults (ayarlar) > school > varsayılan (boş string fallback tetikler)
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || undefined;
    const ogretimYili =
      s(formData.ogretim_yili) ??
      s(formData.academic_year) ??
      s(defaults.ogretim_yili) ??
      academicYears[0] ??
      '2024-2025';
    const sinif =
      s(formData.sinif) ?? s(formData.grade) ?? s(defaults.sinif) ?? '';
    const dersAdi =
      s(formData.ders_adi) ??
      s((formData as any).dersAdi) ??
      s((formData as any).subject_label) ??
      template?.subjectLabel ??
      template?.subjectCode ??
      '';

    const onayTarihi =
      s(formData.onay_tarihi) ??
      s(defaults.onay_tarihi) ??
      new Date().toLocaleDateString('tr-TR');
    // Geriye dönük uyum: eski anahtar `zumreler` da kabul edilir
    const zumrelerRaw =
      s(formData.zumre_ogretmenleri) ??
      s((formData as any).zumreler) ??
      s(defaults.zumre_ogretmenleri) ??
      s((defaults as any).zumreler) ??
      '';
    const zumreOgretmenleri = zumrelerRaw.trim();

    const okulAdi =
      s(formData.okul_adi) ?? s(defaults.okul_adi) ?? (school?.name && school.name !== 'Demo Okulu' ? school.name : '') ?? '';
    const mudurAdi =
      s(formData.mudur_adi) ?? s(defaults.mudur_adi) ?? school?.principalName ?? '';

    // Alt bölüm: tarih "DD / MM / YYYY" formatında (imza bloğu için)
    const onayTarihiAlt = String(onayTarihi).replace(/\./g, ' / ') || 
      new Date().toLocaleDateString('tr-TR').replace(/\./g, ' / ');

    const tarihValue =
      s(formData.tarih) ?? s(onayTarihi) ?? new Date().toLocaleDateString('tr-TR');

    const dersKoduValue =
      s(formData.ders_kodu) ??
      s((formData as any).dersKodu) ??
      s((formData as any).subject_code) ??
      '';

    // İmza alanı: ayarlardan/formdan girilen unvan > user.teacherBranch > ders adı
    const ogretmenUnvani =
      s(formData.ogretmen_unvani) ??
      s((defaults as { ogretmen_unvani?: string }).ogretmen_unvani) ??
      (user.teacherBranch?.trim() ? `${user.teacherBranch.trim()} Öğretmeni` : null) ??
      (dersAdi ? `${dersAdi} Öğretmeni` : 'Öğretmen');

    const base: Record<string, string> = {
      ogretmen_adi: user.display_name ?? user.email ?? '',
      okul_adi: okulAdi,
      mudur_adi: mudurAdi,
      il: school?.city ?? '',
      ilce: school?.district ?? '',
      ogretim_yili: String(ogretimYili),
      sinif: String(sinif),
      ders_adi: String(dersAdi),
      ders_adi_ogretmeni: ogretmenUnvani,
      tarih: String(tarihValue),
      onay_tarihi: String(onayTarihi),
      onay_tarihi_alt: onayTarihiAlt,
      zumre_ogretmenleri: zumreOgretmenleri,
      ...(dersKoduValue ? { ders_kodu: dersKoduValue } : {}),
      gundem_maddeleri:
        '1. Tanışma\n2. Eğitim-öğretim faaliyetleri\n3. Öğrenci davranışları',
      alinan_kararlar: 'Kararlar toplantıda alınacaktır.',
      veli_sayisi: '',
    };
    for (const [k, v] of Object.entries(formData)) {
      base[k] = String(v ?? '');
    }
    if (template) {
      base.ust_baslik_eki = this.isBilsemPlanTemplate(template) ? ' GRUP' : '. SINIF';
    }
    return base;
  }

  /** Zümre öğretmenlerini virgülle ayrılmış string'den diziye çevirir. Format: "İsim|Unvan, İsim2" (| ile branş/unvan ayrılır) */
  private parseZumreOgretmenleri(
    formData: Record<string, string | number>,
    user: User,
    template?: DocumentTemplate,
  ): { isim: string; unvan?: string }[] {
    const defaults = user.evrakDefaults ?? {};
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || undefined;
    const zumrelerRaw =
      s(formData.zumre_ogretmenleri) ??
      s((formData as any).zumreler) ??
      s(defaults.zumre_ogretmenleri) ??
      s((defaults as any).zumreler) ??
      '';

    if (!zumrelerRaw) return [];

    return zumrelerRaw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const pipe = part.indexOf('|');
        if (pipe >= 0) {
          const isim = part.slice(0, pipe).trim();
          const unvan = part.slice(pipe + 1).trim();
          return isim ? { isim, unvan: unvan || undefined } : { isim: part, unvan: undefined };
        }
        return { isim: part, unvan: undefined };
      });
  }

  /** Bilsem: yıllık / 1. dönem / 2. dönem — form + taslak JSON. */
  private readBilsemPlanScopeFromForm(
    formData: Record<string, string | number>,
  ): 'yillik' | 'donem_1' | 'donem_2' | null {
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || '';
    const direct =
      s((formData as Record<string, unknown>).bilsem_plan_scope) ||
      s((formData as Record<string, unknown>).plan_scope);
    if (direct === 'yillik' || direct === 'donem_1' || direct === 'donem_2') return direct;
    const draft = s((formData as Record<string, unknown>).bilsem_yillik_draft_json);
    if (draft) {
      try {
        const j = JSON.parse(draft) as { plan_scope?: string };
        const p = s(j.plan_scope);
        if (p === 'yillik' || p === 'donem_1' || p === 'donem_2') return p;
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  /**
   * Seçilen kazanım/plan sırası: sort_order (yoksa week_order) ile sırala.
   * Aynı week_order için birden fazla satır varsa sıralamada önce gelen (düşük sort_order) ünite/konu kaynağı olur.
   */
  private sortYillikPlanItemsForMerge(items: YillikPlanIcerik[]): YillikPlanIcerik[] {
    return [...items].sort((a, b) => {
      const sa = a.sortOrder != null ? a.sortOrder : a.weekOrder;
      const sb = b.sortOrder != null ? b.sortOrder : b.weekOrder;
      if (sa !== sb) return sa - sb;
      return a.weekOrder - b.weekOrder;
    });
  }

  private planByWeekDedupeFirst(sorted: YillikPlanIcerik[]): Map<number, YillikPlanIcerik> {
    const m = new Map<number, YillikPlanIcerik>();
    for (const i of sorted) {
      if (!m.has(i.weekOrder)) {
        m.set(i.weekOrder, i);
      }
    }
    return m;
  }

  /**
   * MEB 37. hafta: `okul_temelli_planlama` boş, metin sadece ünitede kaldıysa Word’de “Okul temelli” sütununu doldur.
   */
  private mebOkulTemelliCellForMerge(
    weekOrder: number,
    isTatil: boolean,
    isBilsem: boolean,
    i: YillikPlanIcerik | undefined,
  ): string {
    if (isTatil) return '';
    const d = String(i?.okulTemelliPlanlama ?? '').trim();
    if (d) return d;
    if (isBilsem || weekOrder !== 37) return '';
    const u = String(i?.unite ?? '').trim();
    if (u && /okul\s*temelli|okul\s*bazl[ıi]/i.test(u)) return u;
    return '';
  }

  /** Yıllık plan DOCX merge için haftalar dizisi (yillik_plan_icerik + work_calendar). */
  private async fetchHaftalarForMerge(
    template: DocumentTemplate,
    formData: Record<string, string | number>,
    mergeBase: Record<string, string> | undefined,
    user: User,
  ): Promise<Record<string, unknown>[]> {
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || undefined;
    const draftRaw = s((formData as Record<string, unknown>).bilsem_yillik_draft_json);
    if (draftRaw) {
      const input = this.bilsemYillikPlanService.parseDraftJson(draftRaw);
      return this.bilsemYillikPlanService.buildHaftalarFromDraft(input, {
        userId: user.id,
        role: user.role as UserRole,
      });
    }
    /** buildMergeData ile aynı yıl/sınıf (formda ogretim_yili yoksa evrak_defaults devreye girer; burada da kullanılmalı). */
    const ogretimYili =
      mergeBase?.ogretim_yili?.trim() ||
      s(formData.ogretim_yili) ||
      s(formData.academic_year) ||
      '2024-2025';
    const sinifRaw =
      mergeBase?.sinif?.trim() ||
      s(formData.sinif) ||
      (template.grade != null ? String(template.grade) : '');
    const grade = sinifRaw ? parseInt(sinifRaw, 10) : template.grade ?? 9;
    // Birleşik şablon (subject_code null): ders formdan gelir
    let subjectCode =
      (template.subjectCode?.trim()) ||
      s(formData.ders_kodu) ||
      s((formData as any).dersKodu) ||
      s((formData as any).subject_code) ||
      '';
    if (!subjectCode) subjectCode = 'cografya';
    const isBilsemPlan =
      template.curriculumModel?.trim() === 'bilsem' ||
      isBilsemSubjectCode(subjectCode);
    if (isBilsemPlan && !isBilsemSubjectCode(subjectCode)) {
      subjectCode =
        s(formData.ders_kodu) ||
        s((formData as any).dersKodu) ||
        s((formData as any).subject_code) ||
        'bilsem_cografya';
    }

    const items = await this.yillikPlanIcerikService.findAll({
      subject_code: subjectCode,
      grade: isBilsemPlan ? undefined : Number.isNaN(grade) ? undefined : grade,
      academic_year: ogretimYili,
      curriculum_model: isBilsemPlan ? 'bilsem' : undefined,
      ana_grup: isBilsemPlan ? s(formData.ana_grup) : undefined,
      alt_grup: isBilsemPlan ? s(formData.alt_grup) : undefined,
    });
    const sortedPlanItems = this.sortYillikPlanItemsForMerge(items);
    const hasMeaningfulPlanContent = sortedPlanItems.some((i) =>
      Boolean(
        String(i.unite ?? '').trim() ||
        String(i.konu ?? '').trim() ||
        String(i.kazanimlar ?? '').trim() ||
        String(i.surecBilesenleri ?? '').trim() ||
        String(i.olcmeDegerlendirme ?? '').trim() ||
        String(i.belirliGunHaftalar ?? '').trim() ||
        String(i.sosyalDuygusal ?? '').trim() ||
        String(i.degerler ?? '').trim() ||
        String(i.okuryazarlikBecerileri ?? '').trim() ||
        String(i.zenginlestirme ?? '').trim() ||
        String(i.okulTemelliPlanlama ?? '').trim() ||
        Number(i.dersSaati ?? 0) > 0
      )
    );
    if (!hasMeaningfulPlanContent) {
      throw new BadRequestException({
        code: 'PLAN_CONTENT_EMPTY',
        message: `Bu ders/yıl için yıllık plan içeriği bulunamadı veya boş. Ders: ${subjectCode || '-'}, yıl: ${ogretimYili}.`,
      });
    }
    const planByWeek = this.planByWeekDedupeFirst(sortedPlanItems);
    const calendarDb = await this.workCalendarService.findAll(ogretimYili);
    let planCalWeeks = this.workCalendarService.sortWeeksLikeFindAll(
      calendarDb.filter((w) => w.weekOrder >= 1 && w.weekOrder <= 38),
    );
    if (planCalWeeks.length === 0 && hasMebCalendar(ogretimYili)) {
      const meb = mebTeachingWeeksAsWorkCalendar(ogretimYili);
      if (meb.length) planCalWeeks = this.workCalendarService.sortWeeksLikeFindAll(meb);
    }

    const weekLabelMap = new Map<string, string>();
    const weekAyMap = new Map<string, string>();
    const weekTatilMap = new Map<string, { isTatil: boolean; tatilLabel: string | null }>();
    const fillMaps = (rows: { weekOrder: number; haftaLabel?: string | null; ay?: string; isTatil?: boolean; tatilLabel?: string | null }[]) => {
      for (const w of rows) {
        const k = `${ogretimYili}:${w.weekOrder}`;
        if (w.haftaLabel) weekLabelMap.set(k, w.haftaLabel);
        if (w.ay) weekAyMap.set(k, w.ay);
        weekTatilMap.set(k, { isTatil: w.isTatil ?? false, tatilLabel: w.tatilLabel ?? null });
      }
    };
    fillMaps(calendarDb);
    fillMaps(planCalWeeks);
    for (const i of sortedPlanItems) {
      const k = `${ogretimYili}:${i.weekOrder}`;
      if (!weekAyMap.has(k)) {
        const ay = getAyForWeek(ogretimYili, i.weekOrder);
        if (ay) weekAyMap.set(k, ay);
      }
      if (!weekLabelMap.has(k)) {
        weekLabelMap.set(k, `${i.weekOrder}. Hafta`);
      }
    }

    const planMinWeek = sortedPlanItems.length > 0 ? Math.min(...sortedPlanItems.map((i) => i.weekOrder)) : 1;
    const planMaxWeek = sortedPlanItems.length > 0 ? Math.max(...sortedPlanItems.map((i) => i.weekOrder)) : 0;
    const calendarMaxWeek = planCalWeeks.length > 0 ? Math.max(...planCalWeeks.map((w) => w.weekOrder)) : 0;
    /** Bilsem: 38. haftaya kadar tam tablo. MEB: yalnız plandaki hafta aralığı (boş kuyruk yok). */
    const itemsMaxForMerge = isBilsemPlan
      ? Math.max(planMaxWeek, calendarMaxWeek, 38)
      : planMaxWeek > 0
        ? planMaxWeek
        : Math.max(calendarMaxWeek, 1);
    const mebPlanWeekWindow =
      !isBilsemPlan && sortedPlanItems.length > 0 && planMaxWeek >= 1
        ? { min: Math.max(1, planMinWeek), max: Math.min(38, planMaxWeek) }
        : undefined;
    let calendarWeeks: WorkCalendar[] = [];
    if (planCalWeeks.length > 0) {
      calendarWeeks = this.workCalendarService.buildOrderedWeeksForPlanMerge(
        planCalWeeks,
        itemsMaxForMerge,
        mebPlanWeekWindow,
      ).weeks;
    }

    const bilsemScopeMerge = isBilsemPlan ? this.readBilsemPlanScopeFromForm(formData) : null;
    if (bilsemScopeMerge === 'donem_1' && calendarWeeks.length) {
      calendarWeeks = calendarWeeks.filter((w) => w.weekOrder >= 1 && w.weekOrder <= 18);
    } else if (bilsemScopeMerge === 'donem_2' && calendarWeeks.length) {
      calendarWeeks = calendarWeeks.filter((w) => w.weekOrder >= 19 && w.weekOrder <= 38);
    }

    /** Takvim haftası 1..N ile plandaki week_order farklı başlangıçta (ör. plan 5’ten) eşleşmez; kaydır. */
    const cMinWeek =
      calendarWeeks.length > 0 ? Math.min(...calendarWeeks.map((x) => x.weekOrder)) : 0;
    const pMinWeek =
      sortedPlanItems.length > 0 ? Math.min(...sortedPlanItems.map((x) => x.weekOrder)) : 0;
    let weekShift = 0;
    if (
      cMinWeek > 0 &&
      pMinWeek > 0 &&
      pMinWeek > cMinWeek &&
      !planByWeek.has(cMinWeek) &&
      planByWeek.has(pMinWeek)
    ) {
      weekShift = pMinWeek - cMinWeek;
    }
    const allSorted = this.workCalendarService.sortWeeksLikeFindAll(calendarDb);
    const holidaysToInsert: { afterWo: number; row: WorkCalendar }[] = [];
    for (let i = 0; i < allSorted.length; i++) {
      const c = allSorted[i];
      if (c.weekOrder !== 0 || !c.isTatil) continue;
      const seminerText = `${String(c.haftaLabel ?? '')} ${String(c.tatilLabel ?? '')}`.toLocaleLowerCase('tr-TR');
      if (seminerText.includes('seminer')) continue;
      let prevWo = 0;
      for (let j = i - 1; j >= 0; j--) {
        if (allSorted[j].weekOrder >= 1) {
          prevWo = allSorted[j].weekOrder;
          break;
        }
      }
      if (prevWo < 1) continue;
      const firstTeaching = calendarWeeks.find((w) => w.weekOrder >= 1)?.weekOrder ?? 0;
      const lastTeaching = [...calendarWeeks].reverse().find((w) => w.weekOrder >= 1)?.weekOrder ?? 0;
      if (firstTeaching < 1 || lastTeaching < 1) continue;
      if (prevWo < firstTeaching || prevWo > lastTeaching) continue;
      holidaysToInsert.push({ afterWo: prevWo, row: c });
    }
    for (let h = holidaysToInsert.length - 1; h >= 0; h--) {
      const { afterWo, row } = holidaysToInsert[h];
      let insertAt = -1;
      for (let i = calendarWeeks.length - 1; i >= 0; i--) {
        if (calendarWeeks[i].weekOrder === afterWo) {
          insertAt = i + 1;
          break;
        }
      }
      if (insertAt >= 0) calendarWeeks.splice(insertAt, 0, row);
    }

    const planWeekKeys = new Set(planByWeek.keys());
    const anyOverlapCalendarWeek = calendarWeeks.some((w) => w.weekOrder >= 1 && planWeekKeys.has(w.weekOrder));
    const resolvePlanRow = (
      calendarWeekOrder: number,
      teachingIndex: number,
    ): YillikPlanIcerik | undefined => {
      let row = planByWeek.get(calendarWeekOrder);
      if (row) return row;
      if (weekShift !== 0) {
        row = planByWeek.get(calendarWeekOrder + weekShift);
        if (row) return row;
      }
      if (
        !anyOverlapCalendarWeek &&
        teachingIndex >= 0 &&
        teachingIndex < sortedPlanItems.length
      ) {
        return sortedPlanItems[teachingIndex];
      }
      return undefined;
    };

    const fillBilsemPuy = isBilsemPlan;

    if (calendarWeeks.length === 0) {
      let byWeek = Array.from(planByWeek.values()).sort((a, b) => a.weekOrder - b.weekOrder);
      if (bilsemScopeMerge === 'donem_1') {
        byWeek = byWeek.filter((i) => i.weekOrder >= 1 && i.weekOrder <= 18);
      } else if (bilsemScopeMerge === 'donem_2') {
        byWeek = byWeek.filter((i) => i.weekOrder >= 19 && i.weekOrder <= 38);
      }
      return byWeek.map((i) => {
        const key = `${i.academicYear}:${i.weekOrder}`;
        const tatil = weekTatilMap.get(key);
        const haftaLabel = weekLabelMap.get(key) ?? `${i.weekOrder}. Hafta`;
        const isTatil = tatil?.isTatil ?? false;
        const tatilLabel = tatil?.tatilLabel ?? '';
        const isSinav = /s[iı]nav/i.test(haftaLabel);
        const okulTemelli = this.mebOkulTemelliCellForMerge(i.weekOrder, isTatil, isBilsemPlan, i);
        const isSosyalEtkinlik = /sosyal\s*etkinlik/i.test(
          `${haftaLabel} ${String(i.unite ?? '')} ${String(i.konu ?? '')}`,
        );
        const planOkulSosyalAsNormal = !isBilsemPlan && (i.weekOrder === 37 || i.weekOrder === 38);
        /** MEB: tatil / tatil etiketi / sosyal etkinlik sarı; sınav sarı. Bilsem: geniş özel satır mantığı. */
        const isSpecialRow =
          isBilsemPlan &&
          (isTatil ||
            isSinav ||
            !!tatilLabel ||
            (!planOkulSosyalAsNormal && (isSosyalEtkinlik || !!okulTemelli)));
        const row: Record<string, unknown> = {
          week_order: i.weekOrder,
          ay: resolveAyForYillikPlanRow({
            haftaLabel,
            calendarAy: weekAyMap.get(key),
            weekOrder: i.weekOrder,
            academicYear: i.academicYear,
          }),
          hafta_label: haftaLabel,
          is_tatil: isTatil,
          tatil_label: tatilLabel,
          is_special: !isBilsemPlan
            ? isTatil || isSinav || !!tatilLabel || isSosyalEtkinlik
            : isSpecialRow,
          ders_saati: isTatil ? '0' : String(i.dersSaati ?? 0),
          unite: isTatil ? '' : (i.unite ?? ''),
          konu: isTatil ? (tatilLabel || 'Tatil') : (i.konu ?? ''),
          ogrenme_ciktilari: isTatil ? (tatilLabel || '') : (i.kazanimlar ?? ''),
          surec_bilesenleri: isTatil ? '' : (i.surecBilesenleri ?? ''),
          olcme_degerlendirme: isTatil ? '' : (i.olcmeDegerlendirme ?? ''),
          sosyal_duygusal: isTatil ? '' : (i.sosyalDuygusal ?? ''),
          degerler: isTatil ? '' : (i.degerler ?? ''),
          okuryazarlik_becerileri: isTatil ? '' : (i.okuryazarlikBecerileri ?? ''),
          belirli_gun_haftalar: isTatil ? '' : (i.belirliGunHaftalar ?? ''),
          zenginlestirme: isTatil ? '' : (i.zenginlestirme ?? ''),
          okul_temelli_planlama: okulTemelli,
        };
        if (fillBilsemPuy && !isTatil) {
          applyBilsemPuyMergeRowDefaults(row, i.weekOrder, {
            unite: i.unite,
            konu: i.konu,
            kazanimlar: i.kazanimlar,
          });
        }
        return row;
      });
    }

    let teachingIndex = 0;
    return calendarWeeks.map((w) => {
      const isHolidayRow = w.weekOrder === 0 && (w.isTatil ?? false);
      const key = `${ogretimYili}:${w.weekOrder}`;
      const i = isHolidayRow ? undefined : resolvePlanRow(w.weekOrder, teachingIndex);
      const tatil = isHolidayRow ? undefined : weekTatilMap.get(key);
      const haftaLabel = w.haftaLabel || weekLabelMap.get(key) || (w.tatilLabel ?? `${w.weekOrder}. Hafta`);
      const isTatil = isHolidayRow || (tatil?.isTatil ?? w.isTatil) || false;
      const tatilLabel = w.tatilLabel || (tatil?.tatilLabel ?? '');
      if (!isTatil) teachingIndex += 1;
      const isSinav = /s[iı]nav/i.test(haftaLabel);
      const okulTemelli = this.mebOkulTemelliCellForMerge(w.weekOrder, isTatil, isBilsemPlan, i);
      const isSosyalEtkinlik = /sosyal\s*etkinlik/i.test(
        `${haftaLabel} ${String(i?.unite ?? '')} ${String(i?.konu ?? '')}`,
      );
      const planOkulSosyalAsNormal = !isBilsemPlan && (w.weekOrder === 37 || w.weekOrder === 38);
      const isSpecialRow =
        isBilsemPlan &&
        (isTatil ||
          isSinav ||
          !!tatilLabel ||
          (!planOkulSosyalAsNormal && (isSosyalEtkinlik || !!okulTemelli)));
      const row: Record<string, unknown> = {
        week_order: w.weekOrder,
        ay: resolveAyForYillikPlanRow({
          haftaLabel,
          calendarAy: weekAyMap.get(key),
          weekOrder: w.weekOrder,
          academicYear: ogretimYili,
        }),
        hafta_label: haftaLabel,
        is_tatil: isTatil,
        tatil_label: tatilLabel,
        is_special: !isBilsemPlan
          ? isTatil || isSinav || !!tatilLabel || isSosyalEtkinlik
          : isSpecialRow,
        ders_saati: isTatil ? '0' : String(i?.dersSaati ?? 0),
        unite: isTatil ? '' : (i?.unite ?? ''),
        konu: isTatil ? (tatilLabel || 'Tatil') : (i?.konu ?? ''),
        ogrenme_ciktilari: isTatil ? (tatilLabel || '') : (i?.kazanimlar ?? ''),
        surec_bilesenleri: isTatil ? '' : (i?.surecBilesenleri ?? ''),
        olcme_degerlendirme: isTatil ? '' : (i?.olcmeDegerlendirme ?? ''),
        sosyal_duygusal: isTatil ? '' : (i?.sosyalDuygusal ?? ''),
        degerler: isTatil ? '' : (i?.degerler ?? ''),
        okuryazarlik_becerileri: isTatil ? '' : (i?.okuryazarlikBecerileri ?? ''),
        belirli_gun_haftalar: isTatil ? '' : (i?.belirliGunHaftalar ?? ''),
        zenginlestirme: isTatil ? '' : (i?.zenginlestirme ?? ''),
        okul_temelli_planlama: okulTemelli,
      };
      if (fillBilsemPuy && !isTatil) {
        applyBilsemPuyMergeRowDefaults(row, w.weekOrder, {
          unite: i?.unite,
          konu: i?.konu,
          kazanimlar: i?.kazanimlar,
        });
      }
      return row;
    });
  }

  /**
   * Excel merge: ZIP/XML üzerinden placeholder değiştirme.
   * XLSX read/write yerine doğrudan XML'de replace yapılır – merged cells, kolon genişliği,
   * satır yüksekliği, stil vb. korunur; kayma olmaz.
   */
  private mergeXlsx(
    templateBuffer: Buffer,
    data: Record<string, string>,
  ): Buffer {
    let zip: PizZip;
    try {
      zip = new PizZip(templateBuffer);
    } catch {
      throw new BadRequestException({
        code: 'TEMPLATE_CORRUPT',
        message: 'Şablon dosyası bozuk veya geçersiz Excel formatı.',
      });
    }

    const escapeXml = (s: string): string =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const replaceInString = (str: string): string => {
      let out = str;
      for (const [key, value] of Object.entries(data)) {
        if (!key || typeof value !== 'string') continue;
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const enc = escapeXml(value);
        // {key} ve {{key}} formatlarını destekle
        out = out.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), enc);
        out = out.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), enc);
      }
      return out;
    };

    const processXml = (buf: Buffer): Buffer => {
      const str = buf.toString('utf8');
      const replaced = replaceInString(str);
      return Buffer.from(replaced, 'utf8');
    };

    // Shared strings (xl/sharedStrings.xml) – ortak metin havuzu
    const sstFile = zip.file('xl/sharedStrings.xml');
    if (sstFile) {
      zip.file('xl/sharedStrings.xml', processXml(sstFile.asNodeBuffer()));
    }
    // Her sayfa (xl/worksheets/sheetN.xml) – inline string hücreleri
    const sheetFiles = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/);
    sheetFiles.forEach((f) => {
      zip.file(f.name, processXml(f.asNodeBuffer()));
    });

    try {
      return Buffer.from(
        zip.generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        }),
      );
    } catch {
      throw new BadRequestException({
        code: 'TEMPLATE_CORRUPT',
        message: 'Excel şablonu işlenirken hata oluştu. Dosya bozuk olabilir.',
      });
    }
  }

  private mergeDocx(
    templateBuffer: Buffer,
    data: Record<string, unknown>,
    template?: DocumentTemplate,
  ): Buffer {
    let zip: PizZip;
    try {
      zip = new PizZip(templateBuffer);
    } catch {
      throw new BadRequestException({
        code: 'TEMPLATE_CORRUPT',
        message: 'Şablon dosyası bozuk veya geçersiz Word formatı.',
      });
    }
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    try {
      doc.render(data);
    } catch (err: unknown) {
      const props = err && typeof err === 'object' && 'properties' in err
        ? (err as { properties?: { tag?: string; id?: number } }).properties
        : undefined;
      const tag = props?.tag ?? '';
      throw new BadRequestException({
        code: 'MERGE_ERROR',
        message: tag
          ? `Şablonda '${tag}' alanı bulunamadı veya eksik. Form verilerini kontrol edin.`
          : 'Word şablonu birleştirme hatası. Şablondaki alanlar ile form verileri uyuşmuyor olabilir.',
      });
    }
    try {
      return Buffer.from(
        doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 1 },
        }),
      );
    } catch {
      throw new BadRequestException({
        code: 'TEMPLATE_CORRUPT',
        message: 'Word şablonu işlenirken hata oluştu. Dosya bozuk olabilir.',
      });
    }
  }
}



