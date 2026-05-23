/** Zümre Öğretmenler Kurulu tutanağı — varsayılan metinler ve yer tutucular */

export type CouncilTextContext = {
  okul_adi: string;
  ogretim_yili: string;
  program_adi: string;
  tarih: string;
  mudur_adi: string;
};

export const DEFAULT_COUNCIL_MEETING_TOPIC =
  'Haftalık ders dağıtım programının görüşülmesi, incelenmesi ve onaylanması';

export const DEFAULT_COUNCIL_MEETING_PLACE = 'Okul Öğretmenler Odası';

export const DEFAULT_COUNCIL_AGENDA = `1. Açılış ve yoklama
2. Haftalık ders dağıtım programının görüşülmesi
3. Dilek ve temenniler`;

export const DEFAULT_COUNCIL_APPROVAL_TEXT = `Karar 1: {{ogretim_yili}} Eğitim-Öğretim Yılında {{okul_adi}} bünyesinde uygulanacak haftalık ders dağıtım programı, öğretim programı ve Millî Eğitim Bakanlığı mevzuatına uygun olarak hazırlanmış olup Zümre Öğretmenler Kurulunca incelenmiş ve oy çokluğu ile kabul edilmiştir.

Karar 2: Hazırlanan haftalık ders programının Öğretmenler Kurulunda görüşülmesi ve Okul Müdürünün onayına sunulması; onay sonrası ilgili öğretmenlere yazılı olarak tebliğ edilmesi kararlaştırılmıştır.

Karar 3: Programın uygulanmasında aksaklık yaşanmaması için sorumlu öğretmen ve idarecilerin görevlendirilmesine; değişiklik taleplerinin yazılı olarak okul idaresine iletilmesine karar verilmiştir.`;

export function applyCouncilTextPlaceholders(raw: string, ctx: CouncilTextContext): string {
  return raw
    .replace(/\{\{okul_adi\}\}/gi, ctx.okul_adi)
    .replace(/\{\{ogretim_yili\}\}/gi, ctx.ogretim_yili)
    .replace(/\{\{program_adi\}\}/gi, ctx.program_adi)
    .replace(/\{\{tarih\}\}/gi, ctx.tarih)
    .replace(/\{\{mudur_adi\}\}/gi, ctx.mudur_adi);
}

export function councilTextContextFrom(opts: {
  school_name: string;
  academic_year?: string | null;
  program_name: string;
  principal_name?: string | null;
}): CouncilTextContext {
  const tarih = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return {
    okul_adi: opts.school_name.trim() || 'Okul',
    ogretim_yili: opts.academic_year?.trim() || '2025-2026',
    program_adi: opts.program_name.trim() || 'Ders Dağıtım Programı',
    tarih,
    mudur_adi: opts.principal_name?.trim() || '—',
  };
}

/** Karar metnini madde satırlarına böl */
export function splitCouncilDecisions(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const byPara = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (byPara.length > 1) return byPara;
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return [t];
}

export function splitAgendaItems(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length ? lines : [DEFAULT_COUNCIL_AGENDA];
}
