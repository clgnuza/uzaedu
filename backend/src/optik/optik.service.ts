import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../app-config/app-config.service';
import { User } from '../users/entities/user.entity';
import { OptikAdminService } from './optik-admin.service';
import { OptikFormPdfService } from './optik-form-pdf.service';
import { OptikFormTemplate } from './entities/optik-form-template.entity';
import type { OcrResponseDto } from './dto/ocr-response.dto';
import type { GradeRequestDto } from './dto/grade-request.dto';
import type { GradeResultDto } from './dto/grade-response.dto';

const GRADE_RESULT_SCHEMA = `{
  "question_id": "string",
  "mode": "string",
  "score": number,
  "max_score": number,
  "confidence": number,
  "needs_rescan": boolean,
  "reasons": [{ "criterion": "string", "points": number, "evidence": ["string"] }]
}`;

@Injectable()
export class OptikService {
  private openai: OpenAI | null = null;

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly optikAdmin: OptikAdminService,
    private readonly formPdf: OptikFormPdfService,
  ) {}

  listFormTemplatesForUser(userId: string, schoolId: string | null, role: string): Promise<OptikFormTemplate[]> {
    return this.optikAdmin.listFormTemplatesForUser(userId, schoolId, role);
  }

  getFormTemplateForUser(
    templateId: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikFormTemplate> {
    return this.optikAdmin.findFormTemplateForUser(templateId, userId, schoolId, role);
  }

  async generateFormPdf(
    templateId: string,
    userId: string,
    schoolId: string | null,
    role: string,
    options?: { prependBlank?: number },
  ): Promise<{ pdf: Buffer; template: OptikFormTemplate }> {
    const template = await this.optikAdmin.findFormTemplateForUser(templateId, userId, schoolId, role);
    const pdf = await this.formPdf.generatePdf(template, options);
    return { pdf, template };
  }

  private async getOpenAiClient(): Promise<OpenAI> {
    const apiKey = await this.appConfig.getOptikOpenAiKey();
    if (!apiKey?.trim()) {
      throw new BadRequestException({
        code: 'OPTIK_NOT_CONFIGURED',
        message: 'Optik modülü için OpenAI API anahtarı tanımlı değil. Superadmin ayarlardan yapılandırın.',
      });
    }
    return new OpenAI({ apiKey: apiKey.trim() });
  }

  /** Modül durumu – Flutter için */
  async getStatus(): Promise<{ enabled: boolean; configured: boolean; ready: boolean }> {
    const config = await this.appConfig.getOptikConfig();
    const apiKey = await this.appConfig.getOptikOpenAiKey();
    const enabled = config.module_enabled;
    const configured = !!apiKey?.trim();
    return {
      enabled,
      configured,
      ready: enabled && configured,
    };
  }

  /** Modül açık mı ve config hazır mı? */
  async ensureModuleReady(): Promise<void> {
    const config = await this.appConfig.getOptikConfig();
    if (!config.module_enabled) {
      throw new ForbiddenException({
        code: 'OPTIK_MODULE_DISABLED',
        message: 'Optik / Açık Uçlu modülü şu an kapalı.',
      });
    }
    const apiKey = await this.appConfig.getOptikOpenAiKey();
    if (!apiKey?.trim()) {
      throw new BadRequestException({
        code: 'OPTIK_NOT_CONFIGURED',
        message: 'OpenAI API anahtarı tanımlı değil. Superadmin ayarlardan yapılandırın.',
      });
    }
  }

  /** Base64 string'i data URL'e çevir */
  private normalizeImageBase64(input: string): string {
    const trimmed = input.trim();
    if (trimmed.startsWith('data:')) return trimmed;
    const mime = trimmed.length > 100 ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${trimmed}`;
  }

  /**
   * OCR – OpenAI Vision ile görüntüden metin çıkar.
   * Başarısız veya düşük güvende needs_rescan önerilir.
   */
  async ocr(
    imageBase64: string,
    languageHint: 'tr' | 'en' = 'tr',
    user?: User,
    schoolId?: string | null,
  ): Promise<OcrResponseDto> {
    await this.ensureModuleReady();
    const client = await this.getOpenAiClient();
    const config = await this.appConfig.getOptikConfig();

    const imageUrl = this.normalizeImageBase64(imageBase64);

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Bu görselde el yazısı veya basılı metin var. Tüm metni olduğu gibi çıkar. Dil: ${languageHint === 'tr' ? 'Türkçe' : 'İngilizce'}. Sadece çıkarılan metni döndür, başka açıklama yazma. Okunamayan bölümler için [...] koy.`,
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0,
      });

      const text = completion.choices?.[0]?.message?.content?.trim() ?? '';

      if (!text) {
        return {
          text: '',
          confidence: 0,
          needs_rescan: true,
        };
      }

      const hasUnreadable = /\[\.\.\.\]/.test(text) || text.length < 2;
      const confidence = hasUnreadable ? 0.5 : 0.95;
      const needsRescan = confidence < config.confidence_threshold;

      if (user?.id) {
        this.optikAdmin.logUsage(user.id, schoolId ?? null, 'ocr').catch(() => {});
      }
      return {
        text,
        confidence,
        needs_rescan: needsRescan,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      throw new BadRequestException({
        code: 'OCR_FAILED',
        message: `OCR işlemi başarısız: ${msg}`,
      });
    }
  }

  /**
   * Tek soru puanlama – GPT ile.
   * ocr_confidence düşükse needs_rescan=true döner (yanlış puanlamak yerine).
   */
  async grade(
    req: GradeRequestDto,
    user?: User,
    schoolId?: string | null,
  ): Promise<GradeResultDto> {
    await this.ensureModuleReady();

    const config = await this.appConfig.getOptikConfig();

    if (req.ocr_confidence < config.confidence_threshold) {
      // OCR güveni düşük – puanlama yapılmadığı için log yok
      return {
        question_id: req.question_id,
        mode: req.mode,
        score: 0,
        max_score: req.max_score,
        confidence: 0,
        needs_rescan: true,
        reasons: [{ criterion: 'OCR güveni düşük', points: 0, evidence: [] }],
      };
    }

    const client = await this.getOpenAiClient();
    const lang = req.language ?? config.default_language;
    const langLabel = lang === 'tr' ? 'Türkçe' : 'İngilizce';

    const modeInstructions: Record<string, string> = {
      CONTENT: 'Sadece içerik doğruluğuna göre puanla. Dilbilgisi önemsiz.',
      LANGUAGE: 'Sadece dilbilgisi, imla ve açıklığa göre puanla.',
      CONTENT_LANGUAGE: 'Hem içerik hem dil kalitesine göre puanla (ağırlıklı ortalama).',
      MATH_FINAL: 'Sadece sonuca göre puanla. Birim ve yazım stili farkları tolere et.',
      MATH_STEPS: 'Adım adım kısmi puan ver. Her adım için evidence (öğrenci metninden alıntı) belirt.',
    };

    const systemPrompt = `Sen bir sınav puanlayıcısısın. Öğrenci cevabını anahtar metin ve kriterlere göre puanlayacaksın.
Kurallar:
- Dil: ${langLabel}
- Mod: ${req.mode}. ${modeInstructions[req.mode] ?? 'İçeriğe göre puanla.'}
- Maksimum puan: ${req.max_score}
- Yanıtın SADECE geçerli JSON olsun, başka metin yazma.
- Schema: ${GRADE_RESULT_SCHEMA}
- needs_rescan: OCR güveni zaten yeterli (çağıran kontrol etti). Sadece cevap okunamazsa true yap.`;

    const userPrompt = `ANAHTAR METİN:\n${req.key_text}\n\nÖĞRENCİ CEVABI:\n${req.student_text}\n\nJSON yanıt (sadece bu schema'ya uygun):`;

    try {
      const completion = await client.chat.completions.create({
        model: config.openai_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 512,
        temperature: config.openai_temperature ?? 0,
      });

      const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';

      const parsed = this.parseGradeResult(raw, req);
      if (parsed) {
        if (user?.id) this.optikAdmin.logUsage(user.id, schoolId ?? null, 'grade').catch(() => {});
        return parsed;
      }
      if (user?.id) this.optikAdmin.logUsage(user.id, schoolId ?? null, 'grade').catch(() => {});
      return {
        question_id: req.question_id,
        mode: req.mode,
        score: 0,
        max_score: req.max_score,
        confidence: 0.3,
        needs_rescan: true,
        reasons: [{ criterion: 'JSON parse hatası', points: 0, evidence: [raw.slice(0, 100)] }],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      throw new BadRequestException({
        code: 'GRADE_FAILED',
        message: `Puanlama başarısız: ${msg}`,
      });
    }
  }

  private parseGradeResult(raw: string, req: GradeRequestDto): GradeResultDto | null {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch?.[0];
    if (!jsonStr) return null;

    try {
      const obj = JSON.parse(jsonStr) as Record<string, unknown>;
      const score = typeof obj.score === 'number' ? obj.score : 0;
      const maxScore = typeof obj.max_score === 'number' ? obj.max_score : req.max_score;
      const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.8;
      const needsRescan = !!obj.needs_rescan;

      const reasons = Array.isArray(obj.reasons)
        ? (obj.reasons as Array<{ criterion?: string; points?: number; evidence?: string[] }>).map(
            (r) => ({
              criterion: String(r.criterion ?? ''),
              points: typeof r.points === 'number' ? r.points : 0,
              evidence: Array.isArray(r.evidence) ? r.evidence : [],
            }),
          )
        : [];

      return {
        question_id: String(obj.question_id ?? req.question_id),
        mode: String(obj.mode ?? req.mode),
        score: Math.max(0, Math.min(maxScore, score)),
        max_score: maxScore,
        confidence,
        needs_rescan: needsRescan,
        reasons,
      };
    } catch {
      return null;
    }
  }

  /** Toplu puanlama */
  async gradeBatch(
    requests: GradeRequestDto[],
    user?: User,
    schoolId?: string | null,
  ): Promise<{ results: GradeResultDto[] }> {
    await this.ensureModuleReady();

    const results: GradeResultDto[] = [];
    for (const req of requests) {
      try {
        const r = await this.grade(req, user, schoolId);
        results.push(r);
      } catch (e) {
        results.push({
          question_id: req.question_id,
          mode: req.mode,
          score: 0,
          max_score: req.max_score,
          confidence: 0,
          needs_rescan: true,
          reasons: [
            {
              criterion: 'Hata',
              points: 0,
              evidence: [e instanceof Error ? e.message : 'Bilinmeyen hata'],
            },
          ],
        });
      }
    }
    return { results };
  }
}
