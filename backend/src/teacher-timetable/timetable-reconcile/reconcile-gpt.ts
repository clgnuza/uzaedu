import OpenAI from 'openai';
import type {
  ReconcileGptPayload,
  ReconcileGptResponse,
  ReconcileTeacherResult,
  ReconciledFlatRow,
} from './types';

const SYSTEM_PROMPT = `Sen bir okul ders programı uzlaştırma motorusun. Görev: PDF (öğretmen merkezli) ile XLS (kurumsal ızgara) verisini eşleştirip yapılandırılmış program üretmek.

KRİTİK:
- Halüsinasyon YASAK. PDF veya XLS'te olmayan öğretmen, ders, sınıf veya saat UYDURMA.
- PDF sayfa sırası = XLS satır sırası DEĞİLDİR.
- Sınıf adları farklı yazılabilir: "10-A", "10A", "AMP-10A", "10. Sınıf / A" → aynı grup olabilir.
- Düşük güven: needs_review=true, confidence düşük.
- Emin değilsen satır ekleme.

GİRDİ: JSON { xls_records, pdf_teachers, xls_meta, pdf_meta }.
- xls_records: ham kurumsal tablo hücreleri (gün, slot, saat, raw_text).
- pdf_teachers: sayfa bazlı öğretmen adı, branş, slots (öğretmen programı).

ÇIKTI: Yalnızca tek JSON (markdown yok):
{
  "confidence": 0-1,
  "warnings": ["string"],
  "teachers": [
    {
      "teacher": "AD SOYAD",
      "branch": "string|null",
      "schedule": [
        {
          "day": "PAZARTESİ",
          "day_num": 1,
          "slot": 3,
          "time": "10:10-10:50",
          "course": "MATEMATİK",
          "groups": ["10A","10B"],
          "class_section": "10A",
          "source_pdf": {},
          "source_xls": {},
          "confidence": 0.0,
          "needs_review": false
        }
      ]
    }
  ]
}

day_num: 1=Pazartesi … 5=Cuma. slot: günlük ders sırası.
Her schedule öğesi için groups[] (normalize: 10A gibi). class_section: birincil grup.
source_pdf/source_xls: eşleşen ham kayıt özeti (page, row, raw_text parçası).
Boş/TÖ/Öğle/— hücreleri atla.
Aynı öğretmen+day+slot+class_section tekrarını birleştir.`;

function capJsonPayload(payload: ReconcileGptPayload, maxChars: number): ReconcileGptPayload {
  let s = JSON.stringify(payload);
  if (s.length <= maxChars) return payload;
  const ratio = maxChars / s.length;
  const pdfLimit = Math.max(3, Math.floor(payload.pdf_teachers.length * ratio * 0.45));
  const xlsLimit = Math.max(80, Math.floor(payload.xls_records.length * ratio * 0.55));
  return {
    ...payload,
    pdf_teachers: payload.pdf_teachers.slice(0, pdfLimit),
    xls_records: payload.xls_records.slice(0, xlsLimit),
    xls_meta: { ...payload.xls_meta, truncated: true },
  };
}

export function parseReconcileGptJson(raw: string): ReconcileGptResponse | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
  if (fence?.[1]) s = fence[1].trim();
  try {
    const obj = JSON.parse(s) as Record<string, unknown>;
    const confidence =
      typeof obj.confidence === 'number' ? obj.confidence : parseFloat(String(obj.confidence ?? '0'));
    const warnings = Array.isArray(obj.warnings) ? obj.warnings.map((w) => String(w)) : [];
    const teachersRaw = obj.teachers;
    if (!Array.isArray(teachersRaw)) return null;
    const teachers: ReconcileTeacherResult[] = [];
    for (const t of teachersRaw) {
      if (!t || typeof t !== 'object') continue;
      const rec = t as Record<string, unknown>;
      const teacher = String(rec.teacher ?? '').trim();
      if (!teacher) continue;
      const scheduleRaw = rec.schedule;
      const schedule: ReconcileTeacherResult['schedule'] = [];
      if (Array.isArray(scheduleRaw)) {
        for (const item of scheduleRaw) {
          if (!item || typeof item !== 'object') continue;
          const it = item as Record<string, unknown>;
          const dayNum = parseInt(String(it.day_num ?? ''), 10);
          const slot = parseInt(String(it.slot ?? ''), 10);
          const course = String(it.course ?? '').trim();
          const classSection = String(it.class_section ?? '').trim();
          const groupsRaw = it.groups;
          const groups = Array.isArray(groupsRaw)
            ? groupsRaw.map((g) => String(g).trim()).filter(Boolean)
            : classSection
              ? [classSection]
              : [];
          if (!dayNum || dayNum < 1 || dayNum > 5 || !slot || slot < 1 || slot > 12) continue;
          if (!course || groups.length === 0) continue;
          schedule.push({
            day: String(it.day ?? ''),
            day_num: dayNum,
            slot,
            time: it.time != null ? String(it.time) : null,
            course: course.slice(0, 128),
            groups,
            class_section: (classSection || groups[0]!).slice(0, 32),
            source_pdf: (it.source_pdf && typeof it.source_pdf === 'object' ? it.source_pdf : {}) as Record<
              string,
              unknown
            >,
            source_xls: (it.source_xls && typeof it.source_xls === 'object' ? it.source_xls : {}) as Record<
              string,
              unknown
            >,
            confidence:
              typeof it.confidence === 'number'
                ? it.confidence
                : parseFloat(String(it.confidence ?? confidence)) || 0,
            needs_review: !!it.needs_review,
          });
        }
      }
      teachers.push({
        teacher,
        branch: rec.branch != null ? String(rec.branch).slice(0, 200) : null,
        schedule,
      });
    }
    return {
      confidence: Number.isFinite(confidence) ? confidence : 0,
      teachers,
      warnings,
    };
  } catch {
    return null;
  }
}

export async function callReconcileGpt(
  openai: OpenAI,
  model: string,
  payload: ReconcileGptPayload,
  maxChars = 100_000,
): Promise<ReconcileGptResponse | null> {
  const capped = capJsonPayload(payload, maxChars);
  const user = JSON.stringify(capped);
  const completion = await openai.chat.completions.create({
    model,
    max_completion_tokens: 16384,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Uzlaştır ve JSON döndür:\n\n${user}`,
      },
    ],
  });
  const msg = completion.choices?.[0]?.message;
  const refusal = typeof msg?.refusal === 'string' ? msg.refusal.trim() : '';
  if (refusal) return null;
  const rawContent = msg?.content;
  let text = '';
  if (typeof rawContent === 'string') {
    text = rawContent.trim();
  } else if (rawContent != null && typeof rawContent === 'object' && Array.isArray(rawContent)) {
    const parts = rawContent as Array<{ type?: string; text?: string }>;
    text = parts
      .map((p) => (p.type === 'text' && typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim();
  }
  if (!text) return null;
  return parseReconcileGptJson(text);
}

export function reconcileToFlatRows(resp: ReconcileGptResponse, minConfidence = 0.32): ReconciledFlatRow[] {
  const out: ReconciledFlatRow[] = [];
  const seen = new Set<string>();
  for (const t of resp.teachers) {
    const teacher = t.teacher.trim();
    if (!teacher) continue;
    for (const s of t.schedule) {
      const conf = s.confidence;
      if (s.needs_review && conf < minConfidence) continue;
      if (!s.needs_review && conf < minConfidence * 0.85) continue;
      const groups = [...new Set(s.groups.map((g) => g.trim()).filter(Boolean))];
      if (groups.length === 0 && s.class_section) groups.push(s.class_section);
      for (const g of groups) {
        const key = `${teacher}|${s.day_num}|${s.slot}|${g}|${s.course}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          teacher_name: teacher,
          day: s.day_num,
          lesson_num: s.slot,
          class_section: g.slice(0, 32),
          subject: s.course.slice(0, 128),
          confidence: conf,
          needs_review: s.needs_review,
        });
      }
    }
  }
  return out;
}
