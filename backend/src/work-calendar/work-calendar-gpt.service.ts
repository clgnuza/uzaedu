import { BadRequestException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { generateMebWorkCalendar, hasMebCalendar } from '../config/meb-calendar';
import { WorkCalendarService } from './work-calendar.service';

const GPT_MODEL = 'gpt-4o-mini';

export interface WorkCalendarDraftItem {
  week_order: number;
  week_start: string;
  week_end: string;
  ay: string;
  hafta_label: string;
  is_tatil: boolean;
  tatil_label: string | null;
  sinav_etiketleri: string | null;
}

@Injectable()
export class WorkCalendarGptService {
  private openai: OpenAI | null = null;

  constructor(private readonly workCalendarService: WorkCalendarService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey?.trim()) {
      this.openai = new OpenAI({ apiKey: apiKey.trim() });
    }
  }

  isAvailable(): boolean {
    return this.openai != null;
  }

  /** MEB takviminden senkron – mevcut haftalar güncellenir, eksikler eklenir. İçerik silinmez. */
  async syncFromMeb(academicYear: string): Promise<{ created: number; updated: number }> {
    if (!hasMebCalendar(academicYear)) {
      throw new BadRequestException({
        code: 'MEB_NOT_AVAILABLE',
        message: 'Bu öğretim yılı için MEB takvimi tanımlı değil. 2024-2025 veya 2025-2026 seçin.',
      });
    }
    const weeks = generateMebWorkCalendar(academicYear);
    const result = await this.workCalendarService.syncFromMebUpsert(
      academicYear,
      weeks.map((w) => ({
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
    return { created: result.created, updated: result.updated };
  }

  /**
   * Öğretim yılı için çalışma takvimi taslağı oluşturur.
   * Bilinen yıllar (2024-2025, 2025-2026) için MEB resmi takvimi kullanılır; diğerleri GPT ile.
   */
  async generateDraft(academicYear: string): Promise<{ items: WorkCalendarDraftItem[] }> {
    const [startYearStr, endYearStr] = academicYear.split('-').map((s) => s.trim());
    const startYear = parseInt(startYearStr ?? '2024', 10);
    const endYear = parseInt(endYearStr ?? '2025', 10);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
      throw new BadRequestException({
        code: 'INVALID_YEAR',
        message: 'Geçerli öğretim yılı formatı: 2024-2025',
      });
    }

    if (hasMebCalendar(academicYear)) {
      const weeks = generateMebWorkCalendar(academicYear);
      return {
        items: weeks.map((w) => ({
          week_order: w.week_order,
          week_start: w.week_start,
          week_end: w.week_end,
          ay: w.ay,
          hafta_label: w.hafta_label,
          is_tatil: w.is_tatil,
          tatil_label: w.tatil_label,
          sinav_etiketleri: w.sinav_etiketleri,
        })),
      };
    }

    if (!this.openai) {
      throw new BadRequestException({
        code: 'GPT_NOT_CONFIGURED',
        message: 'OpenAI API anahtarı tanımlı değil. Bu öğretim yılı için MEB takvimi henüz tanımlı değil.',
      });
    }

    const systemPrompt = `Sen Türkiye MEB öğretim takvimi uzmanısın. Verilen öğretim yılı için haftalık çalışma takvimi oluştur.

Kurallar:
- Öğretim yılı Eylül ayında başlar (genelde 2. hafta pazartesi).
- Seminer haftaları: Yıl başında (1. dönemden önce) ve yıl sonunda (2. dönemden sonra) birer hafta. is_tatil=true, tatil_label="Seminer Haftası & İlköğretim Uyum Haftası" / "Eğitim Öğretim Yılı Sonu Seminer Haftası".
- Toplam 36 öğretim haftası + seminer + ara tatiller; 1. Dönem ara tatili (Kasım), Yarıyıl (Ocak-Şubat), 2. Dönem ara tatili (Nisan), Yıl sonu (Haziran).
- Her hafta için: week_order (1-36 veya seminer/tatil için 0), week_start (YYYY-MM-DD Pazartesi), week_end (YYYY-MM-DD Cuma), ay (EYLÜL, EKİM...), hafta_label ("N. Hafta: DD-DD Ay" veya seminer/tatil etiketi), is_tatil, tatil_label, sinav_etiketleri.
- Tatil haftaları: ara tatil 1 hafta, yarıyıl 2 hafta, bahar ara 1 hafta. week_order=0 ile işaretle.
- Tarihler gerçekçi olmalı; Pazartesi-Cuma.`;

    const userPrompt = `Öğretim yılı: ${academicYear}

Bu öğretim yılı için MEB standartlarına uygun 36 haftalık çalışma takvimi taslağı oluştur. Tarihleri ${startYear} Eylül - ${endYear} Haziran aralığına göre hesapla.`;

    const jsonSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week_order: { type: 'integer', description: 'Hafta sırası 1-36' },
              week_start: { type: 'string', description: 'YYYY-MM-DD' },
              week_end: { type: 'string', description: 'YYYY-MM-DD' },
              ay: { type: 'string', description: 'EYLÜL, EKİM, KASIM...' },
              hafta_label: { type: 'string', description: '1. Hafta: 8-12 Eylül' },
              is_tatil: { type: 'boolean', description: 'Tatil haftası mı' },
              tatil_label: { type: 'string', description: 'Tatil etiketi; tatil değilse boş string' },
              sinav_etiketleri: { type: 'string', description: 'Sınav etiketi (isteğe bağlı); yoksa boş string' },
            },
            required: ['week_order', 'week_start', 'week_end', 'ay', 'hafta_label', 'is_tatil', 'tatil_label', 'sinav_etiketleri'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    };

    const completion = await this.openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'work_calendar_draft',
          strict: true,
          schema: jsonSchema as Record<string, unknown>,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new BadRequestException({
        code: 'GPT_EMPTY',
        message: 'GPT boş yanıt döndü.',
      });
    }

    const parsed = JSON.parse(content) as { items?: WorkCalendarDraftItem[] };
    const raw = parsed?.items ?? [];
    const byWeek = new Map<number, WorkCalendarDraftItem>();
    for (const i of raw) {
      const wo = Math.round(Number(i.week_order));
      if (wo >= 1 && wo <= 36) {
        byWeek.set(wo, {
          week_order: wo,
          week_start: String(i.week_start ?? '').trim().slice(0, 10),
          week_end: String(i.week_end ?? '').trim().slice(0, 10),
          ay: String(i.ay ?? 'EYLÜL').trim().slice(0, 32),
          hafta_label: String(i.hafta_label ?? '').trim().slice(0, 64) || `${wo}. Hafta`,
          is_tatil: Boolean(i.is_tatil),
          tatil_label: (i.is_tatil && String(i.tatil_label ?? '').trim())
            ? String(i.tatil_label).trim().slice(0, 128)
            : null,
          sinav_etiketleri: String(i.sinav_etiketleri ?? '').trim()
            ? String(i.sinav_etiketleri).trim().slice(0, 256)
            : null,
        });
      }
    }
    const items: WorkCalendarDraftItem[] = [];
    const week1Monday = new Date(Date.UTC(startYear, 8, 1));
    while (week1Monday.getUTCDay() !== 1) week1Monday.setUTCDate(week1Monday.getUTCDate() + 1);
    const addPlaceholder = (w: number) => {
      const d = new Date(week1Monday);
      d.setUTCDate(d.getUTCDate() + (w - 1) * 7);
      const sd = d.toISOString().slice(0, 10);
      d.setUTCDate(d.getUTCDate() + 4);
      const ed = d.toISOString().slice(0, 10);
      items.push({
        week_order: w,
        week_start: sd,
        week_end: ed,
        ay: '—',
        hafta_label: `${w}. Hafta`,
        is_tatil: false,
        tatil_label: null,
        sinav_etiketleri: null,
      });
    };
    for (let w = 1; w <= 36; w++) {
      const existing = byWeek.get(w);
      if (existing) {
        items.push(existing);
      } else {
        addPlaceholder(w);
      }
    }
    items.sort((a, b) => a.week_order - b.week_order);
    return { items };
  }
}
