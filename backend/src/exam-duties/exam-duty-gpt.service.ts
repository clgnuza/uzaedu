/**
 * Sınav görevi: İçeriğin tamamını GPT'ye ver, tablo olarak tarihleri al.
 * Başlangıç = ilk yayınlanma, Son başvuru, 1. sınav günü, 2. sınav günü (varsa).
 */
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../app-config/app-config.service';

const GPT_MODEL = 'gpt-4o-mini';
const GPT_RETRY_DELAY_MS = 1500;

export interface ExamDutyExtractInput {
  title: string;
  body?: string | null;
  sourceUrl?: string | null;
  /** İçerik yoksa RSS/scrape pubDate – başlangıç olarak kullanılabilir */
  fallbackStartDate?: string | null;
}

export interface ExamDutyExtractResult {
  baslangic: string | null;
  son_basvuru: string | null;
  sinav_1_gunu: string | null;
  sinav_2_gunu: string | null;
  application_url: string | null;
  category_slug: string | null;
  is_application_announcement: boolean;
}

export interface ExamDutyExtractResponse {
  result: ExamDutyExtractResult | null;
  gptError: boolean;
}

@Injectable()
export class ExamDutyGptService {
  private readonly logger = new Logger(ExamDutyGptService.name);

  constructor(private readonly appConfig: AppConfigService) {}

  async isAvailable(): Promise<boolean> {
    const key = await this.appConfig.getExamDutyOpenAiKey();
    return !!key?.trim();
  }

  private async getOpenAiClient(): Promise<OpenAI | null> {
    const apiKey = await this.appConfig.getExamDutyOpenAiKey();
    if (!apiKey?.trim()) return null;
    return new OpenAI({ apiKey: apiKey.trim() });
  }

  /**
   * İçeriğin tamamını GPT'ye ver. Son başvuru, 1. sınav günü, 2. sınav günü (varsa), ilk yayınlanma (başlangıç) bul.
   * Tablo olarak YYYY-MM-DD döndür. Saat varsa YYYY-MM-DD HH:mm.
   */
  async extractFromText(
    input: ExamDutyExtractInput,
    gptEnabled: boolean,
  ): Promise<ExamDutyExtractResponse> {
    if (!gptEnabled) return { result: null, gptError: false };
    const openai = await this.getOpenAiClient();
    if (!openai) return { result: null, gptError: false };

    const fullContent = [input.title, input.body].filter(Boolean).join('\n\n').trim();
    if (!fullContent || fullContent.length < 20) return { result: null, gptError: false };

    const jsonSchema = {
      type: 'object',
      properties: {
        baslangic: { type: 'string', description: 'İlk yayınlanma/duyuru tarihi. Yoksa null.' },
        son_basvuru: { type: 'string', description: 'Son başvuru veya son istek tarihi. Sınav günü DEĞİL.' },
        sinav_1_gunu: { type: 'string', description: 'İlk sınav günü (1. oturum veya tek gün).' },
        sinav_2_gunu: { type: 'string', description: 'İkinci/son sınav günü. Tek günlüyse sinav_1_gunu ile aynı veya null.' },
        application_url: { type: 'string', description: 'Başvuru URL (gis.osym, mebbis, auzefgis vb.) veya null' },
        category_slug: { type: 'string', description: 'meb, osym, aof, ataaof, auzef veya null' },
        is_application_announcement: { type: 'boolean', description: 'Metinde son başvuru veya sınav tarihi varsa true' },
      },
      required: ['baslangic', 'son_basvuru', 'sinav_1_gunu', 'sinav_2_gunu', 'application_url', 'category_slug', 'is_application_announcement'],
      additionalProperties: false,
    };

    const systemPrompt = `Türkiye sınav görevi duyurularını analiz et. Verilen içeriğin TAMAMINI oku.

GÖREV: Aşağıdaki tabloyu doldur. Bulamadığın alan null.

| Alan | Açıklama | Örnek |
|------|----------|-------|
| baslangic | İlk yayınlanma/duyuru tarihi (metinde varsa). "Yayın: 12.03.2026", "Duyuru tarihi" vb. | 2026-03-12 veya null |
| son_basvuru | Son başvuru tarihi. "Son gün: 12 Mart", "Son İstek: 3 Mart 23:59", "Başvuru: 24.02-02.03" (bitiş) | 2026-03-12 veya 2026-03-12 23:59 |
| sinav_1_gunu | İlk sınav günü. "Sınav: 4-5 Nisan" → 4 Nisan. "1. Oturum: 27 Aralık" → 27 Aralık. | 2026-04-04 |
| sinav_2_gunu | Son sınav günü. "4-5 Nisan" → 5 Nisan. Tek günlüyse sinav_1_gunu ile aynı veya null. | 2026-04-05 |

KURALLAR:
- Tüm tarihler YYYY-MM-DD veya YYYY-MM-DD HH:mm ( saat varsa ).
- son_basvuru = "Son başvuru", "Son istek zamanı", "Başvuru son tarihi". Sınavın yapıldığı gün ASLA son_basvuru değildir.
- Çoklu sınav: TUS+STS, 4 Adalet sınavı vb. → sinav_1_gunu en erken, sinav_2_gunu en geç, son_basvuru en geç başvuru bitişi.
- baslangic metinde yoksa null dön.
- is_application_announcement: son_basvuru veya sinav_1_gunu bulunduysa true. Hiçbiri yoksa (sadece ücret tablosu) false.`;

    const userPrompt = `İçeriğin tamamını oku. Son başvuru, 1. sınav günü, 2. sınav günü (varsa), ilk yayınlanma (varsa) bul. Tablo olarak döndür.

BAŞLIK: ${input.title}

İÇERİK:
${fullContent.slice(0, 14000)}`;

    const logGptUsage = await this.appConfig.getExamDutySyncOptions().then((o) => o.log_gpt_usage);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model: GPT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.05,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'exam_duty_dates',
              strict: true,
              schema: jsonSchema as Record<string, unknown>,
            },
          },
        });

        if (logGptUsage && completion.usage) {
          this.logger.log(
            `GPT usage: prompt_tokens=${completion.usage.prompt_tokens ?? 0} completion_tokens=${completion.usage.completion_tokens ?? 0}`,
          );
        }

        const content = completion.choices[0]?.message?.content;
        if (!content) return { result: null, gptError: false };

        const parsed = JSON.parse(content) as Record<string, unknown>;
        const result: ExamDutyExtractResult = {
          baslangic: toDateStr(parsed.baslangic),
          son_basvuru: toDateStr(parsed.son_basvuru),
          sinav_1_gunu: toDateStr(parsed.sinav_1_gunu),
          sinav_2_gunu: toDateStr(parsed.sinav_2_gunu),
          application_url: toUrlStr(parsed.application_url),
          category_slug: toCategorySlug(parsed.category_slug),
          is_application_announcement: parsed.is_application_announcement === true,
        };
        return { result, gptError: false };
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number })?.status;
        const isRetryable = status !== undefined && (status === 429 || (status >= 500 && status < 600));
        if (attempt === 0 && isRetryable) {
          await new Promise((r) => setTimeout(r, GPT_RETRY_DELAY_MS));
          continue;
        }
        this.logger.warn(`GPT extractFromText: ${e instanceof Error ? e.message : String(e)}`);
        return { result: null, gptError: true };
      }
    }
    this.logger.warn(`GPT extractFromText: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
    return { result: null, gptError: true };
  }
}

const TR_MONTHS: Record<string, number> = {
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
  temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
};

function toDateStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'null') return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (iso) {
    const y = iso[1];
    const m = iso[2]!.padStart(2, '0');
    const d = iso[3]!.padStart(2, '0');
    return iso[4] && iso[5] ? `${y}-${m}-${d} ${iso[4].padStart(2, '0')}:${iso[5].padStart(2, '0')}` : `${y}-${m}-${d}`;
  }

  const ddmmyy = s.match(/(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (ddmmyy) {
    const d = ddmmyy[1]!.padStart(2, '0');
    const m = ddmmyy[2]!.padStart(2, '0');
    let y = parseInt(ddmmyy[3]!, 10);
    if (y < 100) y += 2000;
    return ddmmyy[4] && ddmmyy[5] ? `${y}-${m}-${d} ${ddmmyy[4].padStart(2, '0')}:${ddmmyy[5].padStart(2, '0')}` : `${y}-${m}-${d}`;
  }

  const tr = s.match(/(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{2,4})/i);
  if (tr) {
    const mn = TR_MONTHS[tr[2]!.toLowerCase()];
    if (mn) {
      const y = parseInt(tr[3]!, 10) < 100 ? 2000 + parseInt(tr[3]!, 10) : parseInt(tr[3]!, 10);
      return `${y}-${String(mn).padStart(2, '0')}-${tr[1]!.padStart(2, '0')}`;
    }
  }
  return null;
}

function toUrlStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'null' || !s.startsWith('http')) return null;
  return s;
}

function toCategorySlug(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  return ['meb', 'osym', 'aof', 'ataaof', 'auzef'].includes(s) ? s : null;
}
