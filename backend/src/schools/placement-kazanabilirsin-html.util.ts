import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

type CheerioLoaded = ReturnType<typeof cheerio.load>;

function normHeaderKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/\|/g, ' ')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPipeMarkdownSeparator(line: string): boolean {
  const t = line.trim();
  const noPipes = t.replace(/\|/g, '');
  return /^\|[\s\-:|]+\|$/u.test(t) || /^[\s\-: ]+$/u.test(noPipes);
}

function tableToPipeLines($: CheerioLoaded, table: AnyNode): string[] {
  const lines: string[] = [];
  $(table)
    .find('tr')
    .each((_: number, tr: AnyNode) => {
      const cells: string[] = [];
      $(tr)
        .children('td, th')
        .each((__: number, td: AnyNode) => {
          const el = $(td);
          const rawHtml = (el.html() ?? '').replace(/<br\s*\/?>/gi, ' ');
          const t = $(`<kb>${rawHtml}</kb>`)
            .text()
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          cells.push(t);
        });
      if (cells.length >= 4) lines.push(`| ${cells.join(' | ')} |`);
    });
  return lines;
}

function isPlacementScoreTable($: CheerioLoaded, table: AnyNode): boolean {
  const txt = $(table).text();
  // Hücre metinleri bitişik birleşince "YılOBP…" olur; \bobp\b eşleşmez
  return /okul\s*adı/i.test(txt) && (/taban/i.test(txt) || /obp/i.test(txt));
}

/**
 * kazanabilirsin.com sayfasındaki HTML `<table>` → `tryParseLgsMarkdownTable` ile uyumlu `| … |` metin.
 * Birden fazla tablo varsa (reklam/ayırıcı sonrası devam listesi, MTAL blokları) hepsi birleştirilir.
 */
export function kazanabilirsinHtmlTableToPipeMarkdown(html: string): string | null {
  const $ = cheerio.load(html);
  const root = $('#singleContent').length ? $('#singleContent') : $('body');
  let candidates = root.find('table').toArray().filter((el) => isPlacementScoreTable($, el));
  if (!candidates.length) {
    candidates = $('table')
      .toArray()
      .filter((el) => isPlacementScoreTable($, el));
  }
  if (!candidates.length) return null;

  const blocks = candidates.map((el) => tableToPipeLines($, el)).filter((b) => b.length >= 2);
  if (!blocks.length) return null;

  const merged: string[] = [];
  let headerKey: string | null = null;
  for (const block of blocks) {
    if (!merged.length) {
      merged.push(...block);
      headerKey = normHeaderKey(block[0] ?? '');
      continue;
    }
    let i = 0;
    if (headerKey && normHeaderKey(block[0] ?? '') === headerKey) i = 1;
    if (block[i] && isPipeMarkdownSeparator(block[i]!)) i += 1;
    merged.push(...block.slice(i));
  }

  const body = merged.join('\n').trim();
  if (
    body.length < 200 ||
    !/\bokul\b/i.test(body) ||
    (!/\btaban\b/i.test(body) && !/obp/i.test(body))
  ) {
    return null;
  }
  return body;
}
