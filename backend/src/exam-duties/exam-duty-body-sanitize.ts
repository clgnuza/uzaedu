/**
 * Haber/agregatör sonundaki resmi duyuru dışı teşvik satırları (ör. Telegram kanalı takip).
 * Tam metin / gövdeye girmemeli.
 */
export function stripExamDutyAggregatorPromoLines(text: string): string {
  if (!text || !text.trim()) return text ?? '';
  const lines = text.split(/\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    const lower = t.toLowerCase();
    if (/\bt\.me\//i.test(t)) continue;
    if (/telegram\.me\//i.test(lower)) continue;
    if (/sinavgorevi/i.test(lower)) continue;
    if (/telegram\s*(kanal|grup|hesab)/i.test(t) && /(takip|edin|üye|abone|katıl)/i.test(t)) continue;
    if (/whatsapp\s*(kanal|grup)/i.test(t) && /(takip|edin|katıl)/i.test(t)) continue;
    if (/\bsınav\s*görevi\b/i.test(lower) && /\btelegram\b/i.test(lower)) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trimEnd();
}
