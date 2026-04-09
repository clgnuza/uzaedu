/** {{anahtar}} yer tutucularını doldurur (HTML içinde güvenli kullanım için değerleri önceden kaçırın). */
export function interpolateMailTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => (vars[key] !== undefined ? vars[key] : ''));
}

export function escapeMailText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
