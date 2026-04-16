/** wa.me — backend `buildWaMeUrl` ile aynı mantık (tarayıcıda WhatsApp Web / uygulama). */
export function buildWaMeUrl(phone: string | null | undefined, text: string): string {
  if (!phone?.trim()) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  if (d.length === 10 && !d.startsWith('90')) d = '90' + d;
  if (d.length < 10) return '';
  let url = `https://wa.me/${d}`;
  const t = (text ?? '').trim();
  if (t) {
    const q = encodeURIComponent(t);
    if (url.length + q.length < 7000) url += `?text=${q}`;
  }
  return url;
}

export function augmentMessageBody(body: string, signature: string): string {
  const b = body.trim();
  const s = signature.trim();
  if (!s) return b;
  if (!b) return s;
  return `${b}\n\n${s}`;
}
