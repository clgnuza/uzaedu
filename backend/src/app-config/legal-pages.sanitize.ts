import * as cheerio from 'cheerio';

/** Tehlikeli etiketleri ve on* handler’ları kaldırır (superadmin içerik). */
export function sanitizeLegalHtml(html: string): string {
  if (!html?.trim()) return '';
  const $ = cheerio.load(html, null, false);
  $('script, iframe, object, embed, link[rel="stylesheet"]').remove();
  $('*').each((_, el) => {
    const node = $(el);
    const attribs = (el as { attribs?: Record<string, string> }).attribs;
    if (attribs) {
      Object.keys(attribs).forEach((k) => {
        if (k.startsWith('on')) node.removeAttr(k);
      });
    }
  });
  return $.html();
}
