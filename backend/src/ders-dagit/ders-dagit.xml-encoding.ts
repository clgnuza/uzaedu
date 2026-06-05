/** aSc / eski Windows XML dosyaları için metin kodlaması (UTF-8, Windows-1254, ISO-8859-9). */

function readDeclaredEncoding(buffer: Buffer): string | null {
  const head = buffer.slice(0, 300).toString('latin1');
  const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
  return m?.[1]?.trim().toLowerCase() ?? null;
}

function decodeWindows1254(buffer: Buffer): string {
  try {
    return new TextDecoder('windows-1254').decode(buffer);
  } catch {
    return buffer.toString('latin1');
  }
}

function turkishTextScore(text: string): number {
  return (text.match(/[çğıöşüÇĞİÖŞÜ]/g) ?? []).length;
}

/** UTF-8 olarak okunmuş Windows-1254 baytları (Ã–, Ä±, ÅŸ …). */
function looksLikeMojibake(text: string): boolean {
  return /Ã[\u0080-\u00BF]|Ä[\u0080-\u00BF]|Å[\u0080-\u00BF]/.test(text);
}

export function decodeXmlBufferToString(buffer: Buffer): string {
  const declared = readDeclaredEncoding(buffer);
  const is1254 =
    declared != null &&
    (declared.includes('1254') ||
      declared.includes('8859-9') ||
      declared.includes('latin5') ||
      declared.includes('cp1254'));

  if (is1254) {
    return decodeWindows1254(buffer).replace(/^\uFEFF/, '');
  }

  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (declared?.includes('utf') && !looksLikeMojibake(utf8)) {
    return utf8;
  }

  if (looksLikeMojibake(utf8) || utf8.includes('\uFFFD')) {
    const tr = decodeWindows1254(buffer).replace(/^\uFEFF/, '');
    if (turkishTextScore(tr) >= turkishTextScore(utf8)) return tr;
  }

  if (!declared) {
    const tr = decodeWindows1254(buffer).replace(/^\uFEFF/, '');
    if (turkishTextScore(tr) > turkishTextScore(utf8) + 1) return tr;
  }

  return utf8;
}
