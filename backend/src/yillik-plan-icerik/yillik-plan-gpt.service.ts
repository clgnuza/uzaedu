import { BadRequestException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { MebFetchService } from '../meb/meb-fetch.service';
import type { ParsedPlanRow } from '../meb/meb-fetch.service';
import { generateMebWorkCalendar, hasMebCalendar } from '../config/meb-calendar';
import { CURRICULUM_UNITES, KAZANIM_PREFIX } from '../config/curriculum-unites';
import {
  formatMebKazanimlarForPrompt,
  hasMebKazanimlar,
} from '../config/curriculum-kazanimlar';
import { getTymmFetchUrl, getTymmSourceUrls } from '../config/meb-sources';
import { AppConfigService } from '../app-config/app-config.service';
import { getDersSaatiStatic } from '../config/ders-saati';

/** Varsayılan model – hız için gpt-5-mini (gpt-5.2 daha yavaş) */
const DEFAULT_GPT_MODEL = 'gpt-5-mini';

/** MEB Excel parse için varsayılan – tablo çıkarma basit bir iş, hızlı model yeterli */
export const DEFAULT_MEB_IMPORT_MODEL = 'gpt-5-nano';

/** Bu modeller sadece temperature=1 destekler (özel değer vermek 400 hatası verir) */
const MODELS_TEMP_1_ONLY = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1', 'gpt-5.2', 'gpt-5.2-pro', 'gpt-4.1'];

/** Kullanıcının seçebileceği GPT modelleri (hızlı → kaliteli sırasıyla) */
export const GPT_TASLAK_MODELS = [
  { id: 'gpt-5-nano', label: 'GPT-5 Nano (en hızlı)', description: 'En hızlı, Excel/import için ideal' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini (önerilen)', description: 'Hızlı, güvenilir' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Ekonomik, hızlı' },
  { id: 'gpt-5.2', label: 'GPT-5.2', description: 'En iyi kalite, daha yavaş' },
  { id: 'gpt-5.2-pro', label: 'GPT-5.2 Pro', description: 'Maksimum kalite' },
  { id: 'gpt-5.1', label: 'GPT-5.1', description: 'İyi reasoning' },
  { id: 'gpt-5', label: 'GPT-5', description: 'Akıllı reasoning' },
  { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Akıllı, non-reasoning' },
  { id: 'gpt-4o', label: 'GPT-4o', description: 'Hızlı, esnek' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Kararlı yedek' },
] as const;
const MAX_RETRIES = 1;
/** Plan max 38 hafta: 36 plan + takvim 38 ise 37-38 (Okul Temelli, Sosyal Etkinlik). 39-40 yok. */
const MAX_WEEKS = 38;

export interface DraftPlanItem {
  week_order: number;
  unite: string;
  konu: string;
  kazanimlar: string;
  ders_saati: number;
  belirli_gun_haftalar: string;
  surec_bilesenleri: string;
  olcme_degerlendirme: string;
  sosyal_duygusal: string;
  degerler: string;
  okuryazarlik_becerileri: string;
  zenginlestirme: string;
  okul_temelli_planlama: string;
}

export interface GenerateDraftResult {
  items: DraftPlanItem[];
  warnings: string[];
  token_usage?: { input: number; output: number };
}

@Injectable()
export class YillikPlanGptService {
  private openai: OpenAI | null = null;

  constructor(
    private readonly workCalendarService: WorkCalendarService,
    private readonly mebFetchService: MebFetchService,
    private readonly appConfigService: AppConfigService,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey?.trim()) {
      this.openai = new OpenAI({ apiKey: apiKey.trim() });
    }
  }

  isAvailable(): boolean {
    return this.openai != null;
  }

  /**
   * Excel parser'dan gelen satırlarda kolon karışmasını düzelt (GPT'ye göndermeden önce).
   * Konu/kazanim, süreç/ölçme swap'ları.
   */
  private normalizeExcelSourceRowsForGpt(rows: ParsedPlanRow[]): ParsedPlanRow[] {
    const looksLikeKazanim = (s: string | null | undefined) => {
      const t = String(s ?? '').trim();
      return (
        /COĞ\.\d+\.\d+\.\d+/i.test(t) ||
        /(^|[\s\n])[a-zçğıöşü]\)/i.test(t) ||
        (t.includes('belirler') || t.includes('çözümler') || t.includes('yorumlar') || t.includes('ilişkilendirir'))
      );
    };
    const looksLikeKonu = (s: string | null | undefined) => {
      const t = String(s ?? '').trim();
      return t.length < 120 && t.length > 2 && !/(^|[\s\n])[a-zçğıöşü]\)/i.test(t) && !/COĞ\.\d+\.\d+\.\d+/i.test(t);
    };
    const looksLikeProcessCodes = (s: string | null | undefined) =>
      /(?:^|[\s,;])(SDB|DB)\d\.\d/i.test(String(s ?? ''));
    const looksLikeAssessment = (s: string | null | undefined) => {
      const t = String(s ?? '').toLowerCase();
      return t.includes('öğrenme çıktıları;') || t.includes('performans görevi') || t.includes('çalışma yaprağı');
    };

    return rows.map((r) => {
      const row = { ...r };
      let konu = String(row.konu ?? '').trim();
      let kazanim = String(row.kazanimlar ?? '').trim();
      let surec = String(row.surec_bilesenleri ?? '').trim();
      let olcme = String(row.olcme_degerlendirme ?? '').trim();

      if (looksLikeKazanim(konu) && !looksLikeKazanim(kazanim) && looksLikeKonu(kazanim)) {
        [konu, kazanim] = [kazanim, konu];
      }
      if (looksLikeProcessCodes(kazanim) && looksLikeKazanim(surec)) {
        [kazanim, surec] = [surec, kazanim];
      }
      if (looksLikeAssessment(surec) && !looksLikeAssessment(olcme)) {
        olcme = surec;
        surec = '';
      }

      return {
        ...row,
        konu: konu || null,
        kazanimlar: kazanim || null,
        surec_bilesenleri: surec || null,
        olcme_degerlendirme: olcme || null,
      };
    });
  }

  /**
   * Parser'dan gelen satırları kullanarak GPT ile 1..targetWeeks arası
   * tam, sıralı ve boşsuz plan üretir (tatil/son hafta kuralları dahil).
   */
  async planFromParsedRows(params: {
    subject_code: string;
    subject_label: string;
    grade: number;
    academic_year: string;
    targetWeeks: number;
    tatilWeeks: number[];
    sourceRows: ParsedPlanRow[];
    model?: string;
  }): Promise<{ items: ParsedPlanRow[]; warnings: string[] }> {
    if (!this.openai) {
      return { items: [], warnings: ['GPT kullanılamıyor: OPENAI_API_KEY tanımlı değil'] };
    }

    const capped = Math.min(Math.max(params.targetWeeks, 1), MAX_WEEKS);
    const normalizedRows = this.normalizeExcelSourceRowsForGpt(params.sourceRows);
    const sourceLines = normalizedRows
      .filter((r) => r.week_order >= 1 && r.week_order <= MAX_WEEKS)
      .sort((a, b) => a.week_order - b.week_order)
      .map(
        (r) =>
          `W${r.week_order} | unite="${(r.unite ?? '').replace(/"/g, "'")}" | konu="${(r.konu ?? '').replace(/"/g, "'")}" | kazanım="${(r.kazanimlar ?? '').slice(0, 1200).replace(/"/g, "'")}" | saat=${r.ders_saati} | süreç="${(r.surec_bilesenleri ?? '').slice(0, 500).replace(/"/g, "'")}" | ölçme="${(r.olcme_degerlendirme ?? '').replace(/"/g, "'")}" | sosyal="${(r.sosyal_duygusal ?? '').replace(/"/g, "'")}" | değer="${(r.degerler ?? '').replace(/"/g, "'")}" | okuryazarlık="${(r.okuryazarlik_becerileri ?? '').replace(/"/g, "'")}" | belirli="${(r.belirli_gun_haftalar ?? '').replace(/"/g, "'")}" | farklılaştırma="${(r.zenginlestirme ?? '').slice(0, 400).replace(/"/g, "'")}" | okul_temelli="${(r.okul_temelli_planlama ?? '').slice(0, 300).replace(/"/g, "'")}"`,
      )
      .join('\n');

    const expectedHour = getDersSaatiStatic(params.subject_code, params.grade);
    const modelToUse =
      params.model && GPT_TASLAK_MODELS.some((m) => m.id === params.model)
        ? params.model
        : DEFAULT_MEB_IMPORT_MODEL;
    const temp1Only = MODELS_TEMP_1_ONLY.includes(modelToUse);

    const systemPrompt = `Sen MEB yıllık plan planlayıcısısın. Excel'den gelen parser verisini kullanarak ${params.subject_label} ${params.grade}. sınıf ${params.academic_year} için 1..${capped} haftalık planı EKSİKSİZ ve HATASIZ üret.

SÜTUN SEMANTİĞİ (ZORUNLU – her alan yalnızca kendi türünde içerik taşır):
- unite: SADECE ünite/tema adı (örn. "COĞRAFYANIN DOĞASI", "MEKÂNSAL BİLGİ TEKNOLOJİLERİ"). Uzun açıklama, a)-b) maddeleri, kazanım kodu YASAK.
- konu: SADECE işlenecek konu özeti / içerik çerçevesi (örn. "Coğrafya Biliminin Gelişimi", "Mekânın Aynası Haritalar"). Kazanım metni, SDB/DB kodları YASAK.
- kazanimlar: SADECE öğrenme çıktıları – COĞ.9.1.1 gibi kodlar, a) b) c) maddeleri, "belirler/çözümler/yorumlar" fiilleri. Ünite adı veya kısa konu başlığı YASAK.
- surec_bilesenleri: SDB1.1, DB2.2, SDB1.2 gibi kodlar. Kazanım açıklama metni YASAK.
- olcme_degerlendirme: Ölçme araçları ("çalışma yaprağı", "performans görevi" vb.). Kazanım metni YASAK.
- zenginlestirme/farklılaştırma: Zenginleştirme/farklılaştırma etkinlikleri. Diğer sütunlardan taşan metin YASAK.

EXCEL BİRLEŞTİRME KURALI: Aynı sütunda birden fazla satır Excel'de merge edilmiş olabilir. Tüm parçalar O SÜTUNA aittir – başka sütuna taşıma. Kaynakta "unite" etiketli veri unite'e, "konu" etiketli veri konuya, "kazanım" etiketli veri kazanimlar'a gitmeli.

HAFTA KURALI: Her haftanın verisi o haftaya ait. Hafta N'nin kazanimlar'ı hafta N+1'e veya N-1'e kopyalanmaz. Karıştırma yasağı.

DÜZELTME: Parser kolon karışması yapmışsa (konu kazanimda, kazanim konuda, süreç ölçmede vb.) DÜZELT. İçeriği doğru sütuna taşı. Hiçbir metin silinmesin; sadece doğru alana taşınsın.

KONU-KAZANIM EŞLEŞMESİ: Her haftada konu ile kazanimlar SEMANTİK UYUMLU olmalı. Örn. konu "İklim Türleri" ise kazanimlar İklim Türleri ile ilgili olmalı; "Coğrafya biliminin konusu" ile karıştırma.

DİĞER KURALLAR:
- Haftalar 1..${capped} tam sıra; atlama yok.
- Tatil (${params.tatilWeeks.join(', ') || 'yok'}): unite="—" konu="—" kazanimlar="—" ders_saati=0.
- 37. hafta SABİT: OKUL TEMELLİ PLANLAMA* (kaynakta başka haftada olsa bile 37'de yaz). 38. hafta SABİT: SOSYAL ETKİNLİK.
- ders_saati: tatil/37-38 dışı ${expectedHour}; 37-38'de 2.
- Eksik hafta (kaynakta o hafta yok): önceki ünite sürdür veya "—".
- Uydurma yok; kaynak metni kullan, yanlış yerleşimleri düzelt.
- Çıktı yalnız JSON şeması.`;

    const jsonSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: capped,
          maxItems: capped,
          items: {
            type: 'object',
            properties: {
              week_order: { type: 'integer' },
              unite: { type: 'string' },
              konu: { type: 'string' },
              kazanimlar: { type: 'string' },
              ders_saati: { type: 'integer' },
              belirli_gun_haftalar: { type: 'string' },
              surec_bilesenleri: { type: 'string' },
              olcme_degerlendirme: { type: 'string' },
              sosyal_duygusal: { type: 'string' },
              degerler: { type: 'string' },
              okuryazarlik_becerileri: { type: 'string' },
              zenginlestirme: { type: 'string' },
              okul_temelli_planlama: { type: 'string' },
            },
            required: [
              'week_order',
              'unite',
              'konu',
              'kazanimlar',
              'ders_saati',
              'belirli_gun_haftalar',
              'surec_bilesenleri',
              'olcme_degerlendirme',
              'sosyal_duygusal',
              'degerler',
              'okuryazarlik_becerileri',
              'zenginlestirme',
              'okul_temelli_planlama',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    };

    const completion = await this.openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Kaynak parser satırları:\n${sourceLines}\n\nHedef hafta sayısı: ${capped}\nTatil haftaları: ${params.tatilWeeks.join(', ') || '(yok)'}`,
        },
      ],
      ...(temp1Only ? { temperature: 1 } : { temperature: 0.1 }),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'planned_from_parser_rows',
          strict: true,
          schema: jsonSchema as Record<string, unknown>,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { items: [], warnings: ['GPT planlayıcı boş yanıt döndü'] };

    const parsed = JSON.parse(content) as { items?: Array<Partial<ParsedPlanRow>> };
    const out: ParsedPlanRow[] = [];
    for (const item of parsed.items ?? []) {
      const wo = Number(item.week_order);
      if (!Number.isFinite(wo) || wo < 1 || wo > capped) continue;
      out.push({
        week_order: Math.round(wo),
        unite: String(item.unite ?? '').trim() || null,
        konu: String(item.konu ?? '').trim() || null,
        kazanimlar: String(item.kazanimlar ?? '').trim() || null,
        ders_saati: Number.isFinite(Number(item.ders_saati)) ? Math.round(Number(item.ders_saati)) : expectedHour,
        belirli_gun_haftalar: String(item.belirli_gun_haftalar ?? '').trim() || null,
        surec_bilesenleri: String(item.surec_bilesenleri ?? '').trim() || null,
        olcme_degerlendirme: String(item.olcme_degerlendirme ?? '').trim() || null,
        sosyal_duygusal: String(item.sosyal_duygusal ?? '').trim() || null,
        degerler: String(item.degerler ?? '').trim() || null,
        okuryazarlik_becerileri: String(item.okuryazarlik_becerileri ?? '').trim() || null,
        zenginlestirme: String(item.zenginlestirme ?? '').trim() || null,
        okul_temelli_planlama: String(item.okul_temelli_planlama ?? '').trim() || null,
      });
    }
    return { items: out.sort((a, b) => a.week_order - b.week_order), warnings: [] };
  }

  /**
   * MEB Excel dosyasını GPT ile parse et. Normal parse 0 satır döndüğünde fallback olarak kullanılır.
   * model: Excel çıkarma basit olduğundan hızlı model (gpt-5-nano, gpt-5-mini) tercih edilir.
   */
  async parseExcelFileToPlan(
    filePath: string,
    params: { subject_code: string; subject_label: string; grade: number; model?: string },
  ): Promise<{ items: ParsedPlanRow[]; planNotu: string | null }> {
    if (!this.openai) {
      throw new BadRequestException({
        code: 'GPT_NOT_CONFIGURED',
        message: 'OpenAI API anahtarı tanımlı değil. GPT ile Excel parse için OPENAI_API_KEY gerekir.',
      });
    }
    const wb = XLSX.readFile(filePath, { cellDates: false });
    const sheetName =
      this.mebFetchService.getSheetNameForGrade(wb, params.grade) ?? wb.SheetNames?.[0];
    const sheet = sheetName ? wb.Sheets[sheetName] : null;
    if (!sheet) return { items: [], planNotu: null };
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' });
    const rows = json.slice(0, 150).map((r) => {
      const arr = Array.isArray(r) ? r : Object.values(r ?? {});
      return arr.map((c) => String(c ?? '').replace(/\t/g, ' ').slice(0, 200)).join('\t');
    });
    const tableText = rows.join('\n');
    if (!tableText.trim()) return { items: [], planNotu: null };

    const grade = params.grade;
    const gradeCode = grade === 1 ? '1' : String(grade);
    const systemPrompt = `Sen bir MEB ${params.subject_label} ${grade}. sınıf yıllık plan Excel parserısın. Verilen tablo metninden SADECE ${grade}. SINIF veri satırlarını çevir.
Alanlar: week_order (1-36 veya takvim 38 ise 1-38), unite, konu, kazanimlar, ders_saati, belirli_gun_haftalar, surec_bilesenleri, olcme_degerlendirme, sosyal_duygusal, degerler, okuryazarlik_becerileri, zenginlestirme, okul_temelli_planlama.

ZORUNLU KURALLAR:
1) Hafta 39, 40 ÜRETME. Maksimum 38. Üniteler KAYNAK sırasına göre takvimsel 1, 2, 3... devam et. Hafta ATLAMA.
2) SADECE ${grade}. sınıf satırları: Kazanım kodları T.${gradeCode}., T.D.${gradeCode}. ile başlamalı. T.3., T.4. vb. farklı sınıf kodlarını ATLAMA.
3) unite: SADECE ünite/tema adı. "X. Hafta: tarih" gibi hafta etiketleri YAZMA.
4) konu: SADECE içerik çerçevesi (örn. "DİNLEME", "OKUMA"). Hafta etiketi YAZMA.
5) okul_temelli_planlama: "Zümre öğretmenler kurulu tarafından ders kapsamında..." gibi UZUN dipnot metni bu sütuna KONMA. Bu metin plan_notu'da. okul_temelli_planlama'da sadece "" veya çok kısa not (örn. "Okul temelli planlama haftası").
6) plan_notu: Tablo altı yıldızlı açıklamalar ve "Zümre öğretmenler kurulu..." metnini buraya yaz.
7) ders_saati: Excel Saat sütunundaki değeri AYNEN yaz. ${params.subject_label} ${grade}. sınıf normal haftalarda ${getDersSaatiStatic(params.subject_code, grade)} saat; tatil/okul temelli planlama/boş haftalarda 2. Kaynağı DEĞİŞTİRME – 2 ise 2, 10 ise 10.
8) HİÇBİR HAFTA ATLAMA. 1–36 (veya 38) arası TÜM haftaları sırayla çıkar. Boş satır varsa week_order ile sıra koru.
9) Başlık satırları atla. Hafta belirsizse satır sırasına göre ata.`;

    const jsonSchema = {
      type: 'object',
      properties: {
        plan_notu: {
          type: 'string',
          description: 'Tablo altındaki yıldızlı açıklamalar (* Okul temelli planlama vb.). Hafta satırlarına ait değil. Yoksa ""',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week_order: { type: 'integer' },
              unite: { type: 'string' },
              konu: { type: 'string' },
              kazanimlar: { type: 'string' },
              ders_saati: { type: 'integer', description: 'Excel Saat sütunu - 10 (normal) veya 2 (tatil/boş hafta). Aynen kopyala.' },
              belirli_gun_haftalar: { type: 'string' },
              surec_bilesenleri: { type: 'string' },
              olcme_degerlendirme: { type: 'string' },
              sosyal_duygusal: { type: 'string' },
              degerler: { type: 'string' },
              okuryazarlik_becerileri: { type: 'string' },
              zenginlestirme: { type: 'string' },
              okul_temelli_planlama: { type: 'string' },
            },
            required: [
              'week_order', 'unite', 'konu', 'kazanimlar', 'ders_saati',
              'belirli_gun_haftalar', 'surec_bilesenleri', 'olcme_degerlendirme',
              'sosyal_duygusal', 'degerler', 'okuryazarlik_becerileri',
              'zenginlestirme', 'okul_temelli_planlama',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['items', 'plan_notu'],
      additionalProperties: false,
    };

    const modelToUse =
      params.model && GPT_TASLAK_MODELS.some((m) => m.id === params.model)
        ? params.model
        : DEFAULT_MEB_IMPORT_MODEL;
    const temp1Only = MODELS_TEMP_1_ONLY.includes(modelToUse);
    const completion = await this.openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Aşağıdaki Excel tablosundan yıllık plan satırlarını çıkar:\n\n${tableText}` },
      ],
      ...(temp1Only ? { temperature: 1 } : { temperature: 0.1 }),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meb_excel_plan',
          strict: true,
          schema: jsonSchema as Record<string, unknown>,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { items: [], planNotu: null };

    const parsed = JSON.parse(content) as {
      items?: Array<Partial<ParsedPlanRow>>;
      plan_notu?: string | null;
    };
    const raw = parsed?.items ?? [];
    let planNotu = parsed?.plan_notu?.trim() || null;

    const result: ParsedPlanRow[] = [];
    const str = (v: unknown, max = 256) => (v != null && String(v).trim()) ? String(v).trim().slice(0, max) : null;
    const expectedDersSaati = getDersSaatiStatic(params.subject_code, params.grade);
    for (const item of raw) {
      const wo = Number(item.week_order);
      if (!Number.isFinite(wo) || wo < 1 || wo > MAX_WEEKS) continue;
      const kazanimStr = str(item.kazanimlar, 4000) || '';
      if (this.hasWrongGradeKazanim(kazanimStr, params.grade)) continue;
      let okulTemelli = str(item.okul_temelli_planlama);
      if (okulTemelli && okulTemelli.length > 120 && /zümre\s*öğretmenler\s*kurulu|okul\s*dışı\s*öğrenme/i.test(okulTemelli)) {
        if (!planNotu) planNotu = okulTemelli;
        okulTemelli = null;
      }
      let uniteVal = str(item.unite);
      let konuVal = str(item.konu, 512);
      if (uniteVal && /^\d+\.\s*Hafta:\s*\d/.test(uniteVal)) uniteVal = null;
      if (konuVal && /^\d+\.\s*Hafta:\s*\d/.test(konuVal)) konuVal = null;
      result.push({
        week_order: Math.round(wo),
        unite: uniteVal,
        konu: konuVal,
        kazanimlar: kazanimStr || null,
        ders_saati: this.normalizeDersSaati(item.ders_saati, expectedDersSaati),
        belirli_gun_haftalar: str(item.belirli_gun_haftalar),
        surec_bilesenleri: str(item.surec_bilesenleri),
        olcme_degerlendirme: str(item.olcme_degerlendirme),
        sosyal_duygusal: str(item.sosyal_duygusal),
        degerler: str(item.degerler),
        okuryazarlik_becerileri: str(item.okuryazarlik_becerileri),
        zenginlestirme: str(item.zenginlestirme),
        okul_temelli_planlama: okulTemelli,
      });
    }
    return { items: result, planNotu };
  }

  /** Excel'den gelen ders_saati geçerliyse (0-10) koru; yoksa config değeri kullan. */
  private normalizeDersSaati(raw: unknown, expected: number): number {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 10) return Math.round(n);
    return expected;
  }

  /** Kazanım kodunda T.X. veya T.D.X. – X hedef sınıftan farklıysa true (sınıf karışıklığı). */
  private hasWrongGradeKazanim(kazanimlar: string, grade: number): boolean {
    if (!kazanimlar?.trim()) return false;
    const m = kazanimlar.match(/\bT\.D?\.(\d+)/);
    if (!m) return false;
    const foundGrade = parseInt(m[1], 10);
    return foundGrade >= 1 && foundGrade <= 12 && foundGrade !== grade;
  }

  async generateDraft(params: {
    subject_code: string;
    subject_label: string;
    grade: number;
    section?: string;
    academic_year: string;
    model?: string;
    /** Excel yüklemeyle verilen satırlar – varsa TYMM fetch atlanır. */
    customSourceRows?: ParsedPlanRow[];
  }): Promise<GenerateDraftResult> {
    if (!this.openai) {
      throw new BadRequestException({
        code: 'GPT_NOT_CONFIGURED',
        message: 'OpenAI API anahtarı tanımlı değil. OPENAI_API_KEY environment variable kontrol edin.',
      });
    }

    const calendar = await this.workCalendarService.findAll(params.academic_year);
    type WeekInfo = { weekOrder: number; weekStart: string; weekEnd: string; ay: string; haftaLabel: string | null };
    let teachingWeeks: WeekInfo[] = this.workCalendarService
      .sortWeeksLikeFindAll(calendar.filter((w) => w.weekOrder >= 1 && w.weekOrder <= MAX_WEEKS))
      .map((w) => ({ weekOrder: w.weekOrder, weekStart: w.weekStart, weekEnd: w.weekEnd, ay: w.ay, haftaLabel: w.haftaLabel }));

    // DB takvimi boş/eksikse ve MEB takvimi tanımlıysa (2024-2025, 2025-2026) MEB config kullan (36 hafta)
    if (teachingWeeks.length < 36 && hasMebCalendar(params.academic_year)) {
      const mebWeeks = generateMebWorkCalendar(params.academic_year);
      teachingWeeks = mebWeeks
        .filter((w) => w.week_order >= 1 && w.week_order <= 36)
        .map((w) => ({
          weekOrder: w.week_order,
          weekStart: w.week_start,
          weekEnd: w.week_end,
          ay: w.ay,
          haftaLabel: w.hafta_label,
        }));
    }

    const subjectCodeLower = params.subject_code?.toLowerCase?.() ?? params.subject_code;
    const unites = CURRICULUM_UNITES[subjectCodeLower]?.[params.grade];
    const kazanimPrefix = KAZANIM_PREFIX[subjectCodeLower] ?? params.subject_code.slice(0, 3).toUpperCase();
    const mebKazanimlarBlock = formatMebKazanimlarForPrompt(subjectCodeLower, params.grade);
    const hasMeb = hasMebKazanimlar(subjectCodeLower, params.grade);

    // Tatil: DB takviminde isTatil=true olan haftalar. MEB config'ten 36 hafta geldiyse tatil yok (tatil blokları week_order=0 ile ayrı).
    const tatilWeeks = calendar
      .filter((w) => w.isTatil && w.weekOrder >= 1 && w.weekOrder <= MAX_WEEKS)
      .map((w) => w.weekOrder);
    let tatilLines = calendar
      .filter((w) => w.isTatil && w.tatilLabel)
      .map((w) => `- ${w.tatilLabel} (Hafta ${w.weekOrder})`)
      .join('\n');
    if (!tatilLines && tatilWeeks.length > 0) {
      tatilLines = `- Standart MEB tatilleri (Hafta ${tatilWeeks.join(', ')})`;
    }

    const totalWeeks = Math.min(
      teachingWeeks.length > 0 ? Math.max(...teachingWeeks.map((w) => w.weekOrder)) : 36,
      MAX_WEEKS,
    );
    const calendarWeekOrders = new Set(
      teachingWeeks.length > 0
        ? teachingWeeks.map((w) => w.weekOrder)
        : Array.from({ length: totalWeeks }, (_, i) => i + 1),
    );
    const weekLabelsBlock =
      teachingWeeks.length > 0
        ? teachingWeeks
            .map((w) => `${w.weekOrder}. Hafta: ${w.haftaLabel ?? `${w.weekStart} - ${w.weekEnd}`}`)
            .join(', ')
        : '';

    const tymmUrls = getTymmSourceUrls(params.subject_code, params.grade);
    let tymmExcelBlock = '';
    let tymmExcelRows: ParsedPlanRow[] = params.customSourceRows ?? [];
    if (tymmExcelRows.length === 0 && getTymmFetchUrl(params.subject_code, params.grade)) {
      try {
        const excelRows = await this.mebFetchService.fetchAndParseTymmTaslak({
          subject_code: params.subject_code,
          grade: params.grade,
          academic_year: params.academic_year,
        });
        tymmExcelRows = excelRows;
        if (excelRows.length > 0) {
          const lines = excelRows.map(
            (r) =>
              `Hafta ${r.week_order}: unite="${r.unite ?? ''}" konu="${r.konu ?? ''}" kazanimlar="${(r.kazanimlar ?? '').slice(0, 200)}" ders_saati=${r.ders_saati} belirli_gun="${r.belirli_gun_haftalar ?? ''}" surec="${r.surec_bilesenleri ?? ''}" olcme="${r.olcme_degerlendirme ?? ''}" sosyal_duygusal="${r.sosyal_duygusal ?? ''}" degerler="${r.degerler ?? ''}" okuryazarlik="${r.okuryazarlik_becerileri ?? ''}" zenginlestirme="${r.zenginlestirme ?? ''}" okul_temelli="${r.okul_temelli_planlama ?? ''}"`,
          );
          const tatilHint =
            tatilWeeks.length > 0
              ? `\nTatil haftaları (bu haftalarda placeholder ver): ${tatilWeeks.join(', ')}`
              : '';
          tymmExcelBlock = `\n\n--- TYMM TASLAK ÇERÇEVE PLANI (${tymmUrls.taslakPlanPage} - ${params.subject_label} ${params.grade}. sınıf Excel planı) ---\nAşağıdaki veri MEB TYMM sayfasındaki ${params.subject_label} taslak planından alınmıştır. Bu veriyi KESINLIKLE AYNEN KULLAN.${tatilHint} Tatil haftalarında: unite="—" konu="—" kazanimlar="—" ders_saati=0. Diğer haftalarda Excel verisini birebir kopyala. Hiçbir metni değiştirme veya uydurma.\n\n${lines.join('\n')}\n--- TYMM veri sonu ---\n`;
        }
      } catch {
        /* TYMM fetch başarısız, normal prompt ile devam */
      }
    }

    const unitesBlock = unites?.length
      ? `MÜFREDAT ÜNİTELERİ (bu sırayla kullan):\n${unites.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
      : 'Müfredat referansı bu ders/sınıf için tanımlı değil; genel MEB yapısına uygun ünite ve konu üret.';

    const kazanimRule = hasMeb
      ? `KAZANIM KURALI (ZORUNLU): Aşağıdaki MEB kazanımlarını SADECE bu metinleri AYNEN kullanarak haftalara dağıt. Kazanimlar alanında sadece "COĞ.10.1.1" gibi kod YAZMA; her kazanım için TAM AÇIKLAMA METNİNİ kopyala-yapıştır (kod + metin + alt maddeler). Kendi metin üretme.`
      : `Kazanım formatı: ${kazanimPrefix}.${params.grade}.ÜNİTE_NO.KAZANIM_NO – tam metin yaz (örn: COĞ.10.1.1. Coğrafi bakış açısı ile olay ve olguları çözümleyebilme...). Sadece kod yazma.`;

    const sonHaftalarBlock = totalWeeks >= 37
      ? `
SON HAFTALAR KURALI (Hafta ${totalWeeks >= 38 ? '37-38' : '37'}):
- Çalışma takvimi ${totalWeeks} hafta ise, ünite içeriği 36 haftaya dağıtılır.
- Hafta ${totalWeeks >= 38 ? '37' : totalWeeks === 37 ? '37' : '36'}: unite="OKUL TEMELLİ PLANLAMA*" konu="Zümre öğretmenler kurulu kararıyla araştırma, proje, yerel çalışmalar vb." kazanimlar="Okul temelli planlama; zümre öğretmenler kurulu tarafından ders kapsamında gerçekleştirilmesi kararlaştırılan araştırma ve gözlem, sosyal etkinlikler, proje çalışmaları, yerel çalışmalar, okuma çalışmaları vb. çalışmaları kapsamaktadır."
${totalWeeks >= 38 ? '- Hafta 38: unite="SOSYAL ETKİNLİK" konu="Yıl sonu etkinlikleri, sosyal etkinlik çalışmaları" kazanimlar="Sosyal etkinlik çalışmaları kapsamında yapılan faaliyetler."' : ''}
- Bu haftalarda da surec_bilesenleri (DB/SDB), olcme_degerlendirme vb. kısa doldur.`
      : '';

    const alanKurallariBlock = `ALAN KURALLARI (ZORUNLU – veriyi doğru sütuna yaz):
- unite: SADECE ünite/tema adı. Örn: "Tema 1: Okuma Kültürü", "2. Ünite: Sayılar", "OKUL TEMELLİ PLANLAMA*", "SOSYAL ETKİNLİK". YASAK: "36. Hafta", tarih, hafta etiketi.
- konu: SADECE İçerik Çerçevesi / işlenecek konu özeti. Örn: "Dinleme/izlemeyi yönetebilme", "Doğal sayılar". YASAK: Kazanım tam metni, DB/SDB kodları.
- kazanimlar: SADECE öğrenme çıktıları tam metni (kod + açıklama). Örn: "T.D.1.1. Dinleyeceklerini/izleyeceklerini amacına uygun olarak seçer." YASAK: Ünite adı, konu özeti.
- surec_bilesenleri: SADECE TYMM kodları. Örn: "DB1.1", "SDB2.2", "SDB1.1 SDB2.1". YASAK: Kazanım metni, "a) b) c)" maddeleri, konu açıklaması.
- belirli_gun_haftalar: SADECE "29 Ekim", "10 Kasım" vb. veya "".
- olcme_degerlendirme, sosyal_duygusal, degerler, okuryazarlik_becerileri: Kısa metin (max 80 karakter) veya "".`;

    const mebKaynakBlock = `VERİ KAYNAĞI (ZORUNLU): Tüm veri SADECE şu MEB TYMM sayfalarından ve ilgili alt sayfalarından alınmalıdır:
- Taslak Çerçeve Planları: ${tymmUrls.taslakPlanPage} (bu sayfadaki ${params.subject_label} dersi taslak planı)
- Öğretim Programları: ${tymmUrls.programPage} (${params.grade}. sınıf ${params.subject_label} ilgili alt sayfaları)
${tymmUrls.taslakRarUrl ? `- Bu dersin taslak Excel planı: ${tymmUrls.taslakRarUrl}` : ''}

KURALLAR: Kendi metin üretme, uydurma kesinlikle yasak. Verilen TYMM Excel verisi varsa onu AYNEN kullan. Yoksa program sayfasındaki ünite/kazanım yapısına TAM uy.`;

    const haftalikDersSaati = await this.appConfigService.getDersSaati(params.subject_code, params.grade);
    const hasTymmExcel = tymmExcelBlock.length > 0;

    // Excel yükleme ile gelen customSourceRows: GPT devreye sok – parser hatalarını düzeltir, eksikleri tamamlar.
    if (params.customSourceRows && params.customSourceRows.length > 0) {
      const gptResult = await this.planFromParsedRows({
        subject_code: params.subject_code,
        subject_label: params.subject_label,
        grade: params.grade,
        academic_year: params.academic_year,
        targetWeeks: totalWeeks,
        tatilWeeks,
        sourceRows: params.customSourceRows,
        model: params.model,
      });
      if (gptResult.items.length >= Math.max(1, totalWeeks - 5)) {
        const draftItems: DraftPlanItem[] = [];
        const byWeek = new Map(gptResult.items.map((r) => [r.week_order, r]));
        let lastU = '';
        let lastK = '';
        let lastKaz = '';
        for (const w of [...calendarWeekOrders].sort((a, b) => a - b)) {
          const r = byWeek.get(w);
          const isTatil = tatilWeeks.includes(w);
          const u = (r?.unite ?? '').trim();
          const k = (r?.konu ?? '').trim();
          const kaz = (r?.kazanimlar ?? '').trim().slice(0, 4000);
          const unite = u || (isTatil ? '—' : lastU || '—');
          const konu = k || (isTatil ? '—' : lastK || '—');
          const kazanimlar = kaz || (isTatil ? '—' : lastKaz || '—');
          if (u) lastU = u;
          if (k) lastK = k;
          if (kaz) lastKaz = kaz;
          draftItems.push({
            week_order: w,
            unite,
            konu,
            kazanimlar,
            ders_saati: isTatil ? 0 : w >= 37 ? 2 : haftalikDersSaati,
            belirli_gun_haftalar: (r?.belirli_gun_haftalar ?? '').trim() || '',
            surec_bilesenleri: (r?.surec_bilesenleri ?? '').trim() || '',
            olcme_degerlendirme: (r?.olcme_degerlendirme ?? '').trim() || '',
            sosyal_duygusal: (r?.sosyal_duygusal ?? '').trim() || '',
            degerler: (r?.degerler ?? '').trim() || '',
            okuryazarlik_becerileri: (r?.okuryazarlik_becerileri ?? '').trim() || '',
            zenginlestirme: (r?.zenginlestirme ?? '').trim() || '',
            okul_temelli_planlama: (r?.okul_temelli_planlama ?? '').trim() || '',
          });
        }
        const hardened = this.hardenDraftResult({
          items: draftItems,
          sourceRows: params.customSourceRows,
          tatilWeeks,
          totalWeeks,
          expectedSaati: haftalikDersSaati,
        });
        return {
          items: hardened.items,
          warnings: gptResult.warnings,
        };
      }
      // GPT yetersiz döndüyse deterministik fallback
    }

    // TYMM kaynağı (fetch) varsa: deterministik build (GPT yok, kaynakla birebir tutarlı).
    if (tymmExcelRows.length > 0) {
      const sourceDraft = this.buildDraftFromSourceRows({
        sourceRows: tymmExcelRows,
        calendarWeekOrders,
        tatilWeeks,
        totalWeeks,
        expectedSaati: haftalikDersSaati,
      });
      const hardened = this.hardenDraftResult({
        items: sourceDraft.items,
        sourceRows: tymmExcelRows,
        tatilWeeks,
        totalWeeks,
        expectedSaati: haftalikDersSaati,
      });
      return {
        items: hardened.items,
        warnings: sourceDraft.warnings,
      };
    }
    const baseRules = hasTymmExcel
      ? `1) ÇALIŞMA TAKVİMİ: Verilen takvimde TAM ${totalWeeks} hafta var. items dizisinde TAM ${totalWeeks} öğe üret; week_order 1'den ${totalWeeks}'e kadar SIRAYLA. HİÇBİR HAFTA ATLAMA.
2) TYMM EXCEL: Aşağıdaki TYMM Excel verisini AYNEN kullan. Değiştirme veya uydurma yasak. Tatil olmayan haftalarda Excel verisini birebir kopyala.
3) TATİL HAFTALARI (listede belirtilen): unite="—" konu="—" kazanimlar="—" ders_saati=0; diğer alanlar "".
4) YASAK: Tatil dışı haftalarda unite/konu/kazanimlar "—" bırakmak. TYMM'de boş hafta varsa önceki hafta sürekliliği veya OKUL TEMELLİ PLANLAMA kullan.
5) ders_saati: TYMM değerini KULLAN (çoğunlukla ${haftalikDersSaati}). Tatilde 0.${sonHaftalarBlock}`
      : `1) ÇALIŞMA TAKVİMİ (EN ÖNEMLİ): Verilen takvimde TAM ${totalWeeks} hafta var. items dizisinde TAM ${totalWeeks} öğe üret; week_order 1, 2, 3, ... ${totalWeeks} SIRAYLA. HİÇBİR HAFTA ATLAMA. EN AZ 36 HAFTA zorunlu.
2) İÇERİK DAĞILIMI: Ünite ve kazanımları ${totalWeeks} haftaya EŞİT dağıt. Her öğretim haftasında (tatil değilse) unite, konu, kazanimlar MUTLAKA dolu. "—" SADECE tatil haftalarında.
3) BOŞ HAFTA YASAK: Tatil dışı hiçbir haftada unite/konu/kazanimlar "—" olmasın. Boş kalacaksa önceki hafta sürekliliği veya OKUL TEMELLİ PLANLAMA kullan.
4) ${kazanimRule}
5) ders_saati: Her öğretim haftasında ${haftalikDersSaati}; tatilde 0.
6) Ünite geçişleri mantıklı; belirli gün/hafta (29 Ekim, 10 Kasım vb.) uygun etiket; surec_bilesenleri (DB1.1, SDB2.2 vb.) her satırda; olcme_degerlendirme, sosyal_duygusal, degerler kısa (max 80 karakter).${sonHaftalarBlock}`;

    const systemPrompt = `Sen bir MEB ${params.subject_label} dersi ${params.grade}. sınıf yıllık plan uzmanısın. Çıktı, verilen çalışma takvimine TAM uyumlu olmalı; EN AZ 36 hafta zorunludur.

## ALAN KURALLARI
${alanKurallariBlock}

## VERİ KAYNAĞI
${mebKaynakBlock}

## ÜRETİM KURALLARI (SIRAYLA UYGULA)
${baseRules}

${hasTymmExcel ? '' : `## MÜFREDAT ÜNİTELERİ\n${unitesBlock}`}
${mebKazanimlarBlock && !hasTymmExcel ? `\n## MEB KAZANIM TAM METİNLERİ (kazanimlar alanında SADECE bunları kullan, aynen kopyala)\n${mebKazanimlarBlock}` : ''}${tymmExcelBlock}`;

    const userPrompt = `## GÖREV
${params.subject_label} ${params.grade}. Sınıf ${params.academic_year} yıllık planı oluştur. Haftalık ${haftalikDersSaati} saat.

## ÇALIŞMA TAKVİMİ (${totalWeeks} HAFTA – BUNLARA TAM UY)
${weekLabelsBlock || `Hafta 1-${totalWeeks} (tarih bilgisi yok)`}
${tatilLines ? `\n## TATİL HAFTALARI (ders_saati=0, unite/konu/kazanimlar="—")\n${tatilLines}` : ''}

## ÇIKTI ZORUNLULUKLARI
- items dizisinde TAM ${totalWeeks} öğe; week_order 1, 2, 3, ... ${totalWeeks} sırayla
- Her hafta: unite, konu, kazanimlar, ders_saati=${haftalikDersSaati} (tatilde 0), surec_bilesenleri (DB/SDB)
- Tatil dışı haftalarda "—" YASAK; boş kalacaksa önceki hafta sürekliliği veya OKUL TEMELLİ PLANLAMA kullan`;

    const jsonSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: totalWeeks,
          maxItems: totalWeeks,
          items: {
            type: 'object',
            properties: {
              week_order: { type: 'integer', description: `Hafta sırası 1-${totalWeeks}` },
              unite: { type: 'string', description: 'Sadece ünite/tema adı (ör: Tema 1). Tarih veya hafta etiketi YAZMA.' },
              konu: { type: 'string', description: 'Sadece İçerik Çerçevesi / konu özeti. Kazanım tam metni YAZMA.' },
              kazanimlar: { type: 'string', description: 'Sadece öğrenme çıktıları tam metni (kod + açıklama). Ünite adı YAZMA.' },
              ders_saati: { type: 'integer', description: 'O hafta ders saati (0-10)' },
              belirli_gun_haftalar: { type: 'string', description: 'Belirli gün/hafta (29 Ekim vb.) veya ""' },
              surec_bilesenleri: { type: 'string', description: 'Sadece TYMM kodları: DB1.1, SDB2.2 vb. Kazanım veya konu metni YAZMA.' },
              olcme_degerlendirme: { type: 'string', description: 'Ölçme yöntemi kısa; yoksa ""' },
              sosyal_duygusal: { type: 'string', description: 'Sosyal-duygusal beceri; yoksa ""' },
              degerler: { type: 'string', description: 'Değer; yoksa ""' },
              okuryazarlik_becerileri: { type: 'string', description: 'Okuryazarlık becerisi; yoksa ""' },
              zenginlestirme: { type: 'string', description: 'Farklılaştırma; yoksa ""' },
              okul_temelli_planlama: { type: 'string', description: 'Okul temelli planlama; yoksa ""' },
            },
            required: [
              'week_order', 'unite', 'konu', 'kazanimlar', 'ders_saati',
              'belirli_gun_haftalar', 'surec_bilesenleri', 'olcme_degerlendirme',
              'sosyal_duygusal', 'degerler', 'okuryazarlik_becerileri',
              'zenginlestirme', 'okul_temelli_planlama',
            ],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    };

    const modelToUse =
      params.model && GPT_TASLAK_MODELS.some((m) => m.id === params.model)
        ? params.model
        : DEFAULT_GPT_MODEL;
    const temp1Only = MODELS_TEMP_1_ONLY.includes(modelToUse);
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ...(temp1Only ? { temperature: 1 } : { temperature: 0.1 }),
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'yillik_plan_taslak',
              strict: true,
              schema: jsonSchema as Record<string, unknown>,
            },
          },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('GPT boş yanıt döndü');
        }

        const parsed = JSON.parse(content) as { items?: DraftPlanItem[] };
        const rawItems = parsed?.items ?? [];

        const validated = this.validateAndNormalize(
          rawItems,
          haftalikDersSaati,
          calendarWeekOrders,
          tatilWeeks,
          totalWeeks,
        );
        const hardenedItems = this.hardenDraftResult({
          items: validated.items,
          sourceRows: tymmExcelRows,
          tatilWeeks,
          totalWeeks,
          expectedSaati: haftalikDersSaati,
        });

        return {
          items: hardenedItems.items,
          warnings: validated.warnings,
          token_usage: completion.usage
            ? { input: completion.usage.prompt_tokens, output: completion.usage.completion_tokens }
            : undefined,
        };
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < MAX_RETRIES) continue;
      }
    }

    throw new BadRequestException({
      code: 'GPT_ERROR',
      message: lastError?.message ?? 'GPT ile taslak oluşturulamadı.',
    });
  }

  private validateAndNormalize(
    raw: (Partial<DraftPlanItem> & { week_order?: number })[],
    expectedSaati: number,
    calendarWeekOrders: Set<number>,
    tatilWeeks: number[],
    totalWeeks: number,
  ): { items: DraftPlanItem[]; warnings: string[] } {
    const warnings: string[] = [];
    const byWeek = new Map<number, DraftPlanItem>();
    const emptyStr = (v: unknown, max = 256) =>
      (v != null && String(v).trim()) ? String(v).trim().slice(0, max) : '';

    for (const item of raw) {
      let weekOrder = Number(item.week_order);
      if (!Number.isFinite(weekOrder) || weekOrder < 1 || weekOrder > MAX_WEEKS) {
        continue;
      }
      weekOrder = Math.round(weekOrder);
      if (!calendarWeekOrders.has(weekOrder)) continue;

      const isTatil = tatilWeeks.includes(weekOrder);
      const dersSaati = isTatil ? 0 : expectedSaati;

      const unite = String(item.unite ?? '').trim().slice(0, 256) || '—';
      const konu = String(item.konu ?? '').trim().slice(0, 512) || '—';
      const kazanimlar = String(item.kazanimlar ?? '').trim().slice(0, 4000) || '—';

      if (!isTatil && kazanimlar === '—') {
        warnings.push(`${weekOrder}. hafta: Kazanım boş`);
      }

      byWeek.set(weekOrder, {
        week_order: weekOrder,
        unite,
        konu,
        kazanimlar,
        ders_saati: dersSaati,
        belirli_gun_haftalar: emptyStr(item.belirli_gun_haftalar, 256),
        surec_bilesenleri: isTatil ? '' : emptyStr(item.surec_bilesenleri, 256),
        olcme_degerlendirme: isTatil ? '' : emptyStr(item.olcme_degerlendirme, 256),
        sosyal_duygusal: isTatil ? '' : emptyStr(item.sosyal_duygusal, 256),
        degerler: isTatil ? '' : emptyStr(item.degerler, 256),
        okuryazarlik_becerileri: isTatil ? '' : emptyStr(item.okuryazarlik_becerileri, 256),
        zenginlestirme: isTatil ? '' : emptyStr(item.zenginlestirme, 256),
        okul_temelli_planlama: isTatil ? '' : emptyStr(item.okul_temelli_planlama, 256),
      });
    }

    const emptyItem = (w: number, tatil: boolean): DraftPlanItem => ({
      week_order: w,
      unite: '—',
      konu: '—',
      kazanimlar: '—',
      ders_saati: tatil ? 0 : expectedSaati,
      belirli_gun_haftalar: '',
      surec_bilesenleri: '',
      olcme_degerlendirme: '',
      sosyal_duygusal: '',
      degerler: '',
      okuryazarlik_becerileri: '',
      zenginlestirme: '',
      okul_temelli_planlama: '',
    });

    const items: DraftPlanItem[] = [];
    for (const w of [...calendarWeekOrders].sort((a, b) => a - b)) {
      const existing = byWeek.get(w);
      const isTatil = tatilWeeks.includes(w);
      items.push(existing ?? emptyItem(w, isTatil));
      if (!existing) warnings.push(`${w}. hafta: Eksik, placeholder eklendi`);
    }

    items.sort((a, b) => a.week_order - b.week_order);

    // Son haftalar (37, 38) için MEB standart değerler
    const SON_HAFTA_37 = {
      unite: 'OKUL TEMELLİ PLANLAMA*',
      konu: 'Zümre öğretmenler kurulu kararıyla araştırma, proje, yerel çalışmalar vb.',
      kazanimlar: 'Okul temelli planlama; zümre öğretmenler kurulu tarafından ders kapsamında gerçekleştirilmesi kararlaştırılan araştırma ve gözlem, sosyal etkinlikler, proje çalışmaları, yerel çalışmalar, okuma çalışmaları vb. çalışmaları kapsamaktadır.',
    };
    const SON_HAFTA_38 = {
      unite: 'SOSYAL ETKİNLİK',
      konu: 'Yıl sonu etkinlikleri, sosyal etkinlik çalışmaları',
      kazanimlar: 'Sosyal etkinlik çalışmaları kapsamında yapılan faaliyetler.',
    };

    // Tatil dışı haftalarda "—" olan alanları doldur (GPT boş bırakma sorununu gider)
    let lastUnite = '';
    let lastKonu = '';
    let lastKazanimlar = '';
    for (const it of items) {
      const isTatil = tatilWeeks.includes(it.week_order);
      if (isTatil) continue;
      const needsUnite = it.unite === '—' || !it.unite?.trim();
      const needsKonu = it.konu === '—' || !it.konu?.trim();
      const needsKazanimlar = it.kazanimlar === '—' || !it.kazanimlar?.trim();
      const w = it.week_order;

      let defaultUnite: string;
      let defaultKonu: string;
      let defaultKazanimlar: string;
      if (totalWeeks >= 38 && w === 38) {
        defaultUnite = SON_HAFTA_38.unite;
        defaultKonu = SON_HAFTA_38.konu;
        defaultKazanimlar = SON_HAFTA_38.kazanimlar;
      } else if (totalWeeks >= 37 && w === 37) {
        defaultUnite = SON_HAFTA_37.unite;
        defaultKonu = SON_HAFTA_37.konu;
        defaultKazanimlar = SON_HAFTA_37.kazanimlar;
      } else if (w <= 3) {
        defaultUnite = 'Giriş / Ders Tanıtımı';
        defaultKonu = 'Dersin tanıtımı ve genel bilgilendirme';
        defaultKazanimlar = 'Derse yönelik genel beklentiler';
      } else {
        defaultUnite = lastUnite || '—';
        defaultKonu = lastKonu || '—';
        defaultKazanimlar = lastKazanimlar || '—';
      }

      const fillUnite = needsUnite ? (lastUnite || defaultUnite) : it.unite;
      const fillKonu = needsKonu ? (lastKonu || defaultKonu) : it.konu;
      const fillKazanimlar = needsKazanimlar ? (lastKazanimlar || defaultKazanimlar) : it.kazanimlar;
      it.unite = fillUnite;
      it.konu = fillKonu;
      it.kazanimlar = fillKazanimlar.slice(0, 4000);
      if (needsUnite || needsKonu || needsKazanimlar) {
        warnings.push(`${w}. hafta: Boş alanlar dolduruldu${w === 37 || w === 38 ? ` (son hafta standardı)` : ''}`);
      }
      if (it.unite && it.unite !== '—') lastUnite = it.unite;
      if (it.konu && it.konu !== '—') lastKonu = it.konu;
      if (it.kazanimlar && it.kazanimlar !== '—') lastKazanimlar = it.kazanimlar;
    }

    return { items, warnings };
  }

  private hardenDraftResult(params: {
    items: DraftPlanItem[];
    sourceRows: ParsedPlanRow[];
    tatilWeeks: number[];
    totalWeeks: number;
    expectedSaati: number;
  }): { items: DraftPlanItem[] } {
    const sourceByWeek = new Map<number, ParsedPlanRow>(
      (params.sourceRows ?? [])
        .filter((r) => r.week_order >= 1 && r.week_order <= MAX_WEEKS)
        .map((r) => [r.week_order, r]),
    );
    const isPlaceholder = (s: string | null | undefined) => {
      const t = String(s ?? '').trim();
      return !t || t === '—';
    };
    const isLongSchoolNote = (s: string | null | undefined) => {
      const t = String(s ?? '').toLowerCase();
      return t.includes('zümre öğretmenler kurulu tarafından') || t.includes('okul dışı öğrenme etkinlikleri');
    };
    const looksLikeProcessCodes = (v: string | null | undefined) => {
      const s = String(v ?? '').trim();
      if (!s) return false;
      return /(?:^|[\s,;])(SDB|DB)\d\.\d/i.test(s);
    };
    const looksLikeLearningOutcomes = (v: string | null | undefined) => {
      const s = String(v ?? '').trim();
      if (!s) return false;
      return /(^|[\s\n])[a-zçğıöşü]\)/i.test(s) || s.includes('belirler') || s.includes('çözümler') || s.includes('yorumlar');
    };
    const looksLikeAssessment = (v: string | null | undefined) => {
      const s = String(v ?? '').toLowerCase();
      return s.includes('öğrenme çıktıları;') || s.includes('değerlendirilebilir') || s.includes('performans görevi');
    };
    const normalizeSourceRow = (src?: ParsedPlanRow | null): ParsedPlanRow | null => {
      if (!src) return null;
      const row: ParsedPlanRow = { ...src };
      const k = String(row.kazanimlar ?? '').trim();
      const s = String(row.surec_bilesenleri ?? '').trim();
      const o = String(row.olcme_degerlendirme ?? '').trim();

      if (looksLikeProcessCodes(k) && looksLikeLearningOutcomes(s)) {
        row.kazanimlar = s || null;
        row.surec_bilesenleri = k || null;
      }
      if (looksLikeAssessment(s) && !looksLikeAssessment(o)) {
        row.olcme_degerlendirme = s || null;
        row.surec_bilesenleri = String(row.surec_bilesenleri ?? '')
          .replace(s, '')
          .trim() || null;
      }
      return row;
    };
    const out = [...params.items].sort((a, b) => a.week_order - b.week_order);
    let lastUnite = '';
    let lastKonu = '';
    let lastKazanim = '';

    for (let i = 0; i < out.length; i++) {
      const w = out[i].week_order;
      const isTatil = params.tatilWeeks.includes(w);
      const source = normalizeSourceRow(sourceByWeek.get(w));

      // Son haftalar standardı
      if (params.totalWeeks >= 37 && w === 37) {
        out[i] = {
          ...out[i],
          unite: 'OKUL TEMELLİ PLANLAMA*',
          konu: 'Zümre öğretmenler kurulu kararıyla araştırma, proje, yerel çalışmalar vb.',
          kazanimlar:
            'Okul temelli planlama; zümre öğretmenler kurulu tarafından ders kapsamında gerçekleştirilmesi kararlaştırılan araştırma ve gözlem, sosyal etkinlikler, proje çalışmaları, yerel çalışmalar, okuma çalışmaları vb. çalışmaları kapsamaktadır.',
          ders_saati: 2,
        };
      } else if (params.totalWeeks >= 38 && w === 38) {
        out[i] = {
          ...out[i],
          unite: 'SOSYAL ETKİNLİK',
          konu: 'Yıl sonu etkinlikleri, sosyal etkinlik çalışmaları',
          kazanimlar: 'Sosyal etkinlik çalışmaları kapsamında yapılan faaliyetler.',
          ders_saati: 2,
        };
      } else if (!isTatil) {
        // TYMM kaynağı varsa hafta bazında kilitle: konu sırası/kolon kaymasını önlemek için
        if (source) {
          if (!isPlaceholder(source.unite)) out[i].unite = String(source.unite);
          if (!isPlaceholder(source.konu)) out[i].konu = String(source.konu);
          if (!isPlaceholder(source.kazanimlar)) out[i].kazanimlar = String(source.kazanimlar).slice(0, 4000);
          if (!isPlaceholder(source.belirli_gun_haftalar)) out[i].belirli_gun_haftalar = String(source.belirli_gun_haftalar);
          if (!isPlaceholder(source.surec_bilesenleri)) out[i].surec_bilesenleri = String(source.surec_bilesenleri);
          if (!isPlaceholder(source.olcme_degerlendirme)) out[i].olcme_degerlendirme = String(source.olcme_degerlendirme);
          if (!isPlaceholder(source.sosyal_duygusal)) out[i].sosyal_duygusal = String(source.sosyal_duygusal);
          if (!isPlaceholder(source.degerler)) out[i].degerler = String(source.degerler);
          if (!isPlaceholder(source.okuryazarlik_becerileri)) out[i].okuryazarlik_becerileri = String(source.okuryazarlik_becerileri);
          if (!isPlaceholder(source.zenginlestirme)) out[i].zenginlestirme = String(source.zenginlestirme);
          if (!isPlaceholder(source.okul_temelli_planlama)) out[i].okul_temelli_planlama = String(source.okul_temelli_planlama);
        }

        // Boş alan varsa önce aynı haftanın TYMM parse kaynağıyla doldur
        if (isPlaceholder(out[i].unite) && source && !isPlaceholder(source.unite)) {
          out[i].unite = String(source.unite);
        }
        if (isPlaceholder(out[i].konu) && source && !isPlaceholder(source.konu)) {
          out[i].konu = String(source.konu);
        }
        if (isPlaceholder(out[i].kazanimlar) && source && !isPlaceholder(source.kazanimlar)) {
          out[i].kazanimlar = String(source.kazanimlar).slice(0, 4000);
        }

        // Hala boşsa komşu hafta sürekliliği. PEKİŞTİRME kullanılmaz; yoksa "—".
        if (isPlaceholder(out[i].unite) && lastUnite) out[i].unite = lastUnite;
        else if (isPlaceholder(out[i].unite) || out[i].unite === 'PEKİŞTİRME HAFTASI') out[i].unite = lastUnite || '—';
        if (isPlaceholder(out[i].konu) && lastKonu) out[i].konu = lastKonu;
        else if (isPlaceholder(out[i].konu) || out[i].konu === 'Önceki konuların pekiştirilmesi') out[i].konu = lastKonu || '—';
        if (isPlaceholder(out[i].kazanimlar) && lastKazanim) out[i].kazanimlar = lastKazanim;
        else if (isPlaceholder(out[i].kazanimlar) || out[i].kazanimlar === 'Ünite kazanımlarının pekiştirilmesi') out[i].kazanimlar = lastKazanim || '—';

        // Normal haftalarda önce TYMM kaynağındaki saat korunur; yoksa beklenen saat kullanılır
        out[i].ders_saati =
          source && Number.isFinite(Number(source.ders_saati))
            ? this.normalizeDersSaati(source.ders_saati, params.expectedSaati)
            : params.expectedSaati;
      }

      if (isLongSchoolNote(out[i].okul_temelli_planlama)) {
        out[i].okul_temelli_planlama = '';
      }
      if (!isPlaceholder(out[i].unite)) lastUnite = out[i].unite;
      if (!isPlaceholder(out[i].konu)) lastKonu = out[i].konu;
      if (!isPlaceholder(out[i].kazanimlar)) lastKazanim = out[i].kazanimlar;
    }

    return { items: out };
  }

  private buildDraftFromSourceRows(params: {
    sourceRows: ParsedPlanRow[];
    calendarWeekOrders: Set<number>;
    tatilWeeks: number[];
    totalWeeks: number;
    expectedSaati: number;
  }): { items: DraftPlanItem[]; warnings: string[] } {
    const warnings: string[] = [];
    const byWeek = new Map<number, ParsedPlanRow>(
      params.sourceRows
        .filter((r) => r.week_order >= 1 && r.week_order <= MAX_WEEKS)
        .map((r) => [r.week_order, r]),
    );
    const isPlaceholder = (v: string | null | undefined) => {
      const s = String(v ?? '').trim();
      return !s || s === '—';
    };
    const looksLikeProcessCodes = (v: string | null | undefined) => {
      const s = String(v ?? '').trim();
      if (!s) return false;
      return /(?:^|[\s,;])(SDB|DB)\d\.\d/i.test(s);
    };
    const looksLikeLearningOutcomes = (v: string | null | undefined) => {
      const s = String(v ?? '').trim();
      if (!s) return false;
      return /(^|[\s\n])[a-zçğıöşü]\)/i.test(s) || s.includes('belirler') || s.includes('çözümler') || s.includes('yorumlar');
    };
    const looksLikeAssessment = (v: string | null | undefined) => {
      const s = String(v ?? '').toLowerCase();
      return s.includes('öğrenme çıktıları;') || s.includes('değerlendirilebilir') || s.includes('performans görevi');
    };
    const normalizeSourceRow = (src?: ParsedPlanRow | null): ParsedPlanRow | null => {
      if (!src) return null;
      const row: ParsedPlanRow = { ...src };
      const k = String(row.kazanimlar ?? '').trim();
      const s = String(row.surec_bilesenleri ?? '').trim();
      const o = String(row.olcme_degerlendirme ?? '').trim();

      // Bazı TYMM şablonlarında kazanım/süreç kayabiliyor: SDB kodları kazanımda, a)-b) maddeleri süreçte.
      if (looksLikeProcessCodes(k) && looksLikeLearningOutcomes(s)) {
        row.kazanimlar = s || null;
        row.surec_bilesenleri = k || null;
      }
      // Ölçme metni yanlışlıkla süreçe geldiyse ölçmeye taşı.
      if (looksLikeAssessment(s) && !looksLikeAssessment(o)) {
        row.olcme_degerlendirme = s || null;
        row.surec_bilesenleri = String(row.surec_bilesenleri ?? '')
          .replace(s, '')
          .trim() || null;
      }
      return row;
    };

    const out: DraftPlanItem[] = [];
    let lastUnite = '';
    let lastKonu = '';
    let lastKazanim = '';
    for (const w of [...params.calendarWeekOrders].sort((a, b) => a - b)) {
      const isTatil = params.tatilWeeks.includes(w);
      const src = normalizeSourceRow(byWeek.get(w));
      let unite = src?.unite ?? '';
      let konu = src?.konu ?? '';
      let kazanim = src?.kazanimlar ?? '';

      if (params.totalWeeks >= 38 && w === 38) {
        unite = 'SOSYAL ETKİNLİK';
        konu = 'Yıl sonu etkinlikleri, sosyal etkinlik çalışmaları';
        kazanim = 'Sosyal etkinlik çalışmaları kapsamında yapılan faaliyetler.';
      } else if (params.totalWeeks >= 37 && w === 37) {
        unite = 'OKUL TEMELLİ PLANLAMA*';
        konu = 'Zümre öğretmenler kurulu kararıyla araştırma, proje, yerel çalışmalar vb.';
        kazanim =
          'Okul temelli planlama; zümre öğretmenler kurulu tarafından ders kapsamında gerçekleştirilmesi kararlaştırılan araştırma ve gözlem, sosyal etkinlikler, proje çalışmaları, yerel çalışmalar, okuma çalışmaları vb. çalışmaları kapsamaktadır.';
      } else if (!isTatil) {
        // Hafta sırası kilidi: ileri haftadan geri haftaya içerik taşıma YASAK.
        // Sadece aynı hafta kaynağı, sonra önceki hafta sürekliliği. PEKİŞTİRME kullanılmaz.
        if (isPlaceholder(unite) && lastUnite) unite = lastUnite;
        if (isPlaceholder(konu) && lastKonu) konu = lastKonu;
        if (isPlaceholder(kazanim) && lastKazanim) kazanim = lastKazanim;
        if (isPlaceholder(unite)) unite = '—';
        if (isPlaceholder(konu)) konu = '—';
        if (isPlaceholder(kazanim)) kazanim = '—';
      } else {
        unite = '—';
        konu = '—';
        kazanim = '—';
      }

      const item: DraftPlanItem = {
        week_order: w,
        unite: String(unite).trim() || '—',
        konu: String(konu).trim() || '—',
        kazanimlar: String(kazanim).trim().slice(0, 4000) || '—',
        ders_saati: isTatil ? 0 : w >= 37 ? 2 : params.expectedSaati,
        belirli_gun_haftalar: String(src?.belirli_gun_haftalar ?? '').trim(),
        surec_bilesenleri: String(src?.surec_bilesenleri ?? '').trim(),
        olcme_degerlendirme: String(src?.olcme_degerlendirme ?? '').trim(),
        sosyal_duygusal: String(src?.sosyal_duygusal ?? '').trim(),
        degerler: String(src?.degerler ?? '').trim(),
        okuryazarlik_becerileri: String(src?.okuryazarlik_becerileri ?? '').trim(),
        zenginlestirme: String(src?.zenginlestirme ?? '').trim(),
        okul_temelli_planlama: String(src?.okul_temelli_planlama ?? '').trim(),
      };

      if (!isTatil && item.unite === '—' && (item.konu === '—' || item.kazanimlar === '—')) {
        warnings.push(`${w}. hafta: Kaynakta eksik içerik`);
      }
      if (!isPlaceholder(item.unite)) lastUnite = item.unite;
      if (!isPlaceholder(item.konu)) lastKonu = item.konu;
      if (!isPlaceholder(item.kazanimlar)) lastKazanim = item.kazanimlar;
      out.push(item);
    }
    return { items: out, warnings };
  }
}
