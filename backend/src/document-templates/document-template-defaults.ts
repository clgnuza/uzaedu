/** Default style constants for MEB-compatible Word tables */
export const TABLE_STYLES = {
  /** MEB TYÇİ üst kategori rengi */
  LIGHT_GREEN: 'D4EDDA',
  /** MEB TYÇİ alt sütun rengi */
  LIGHT_GRAY: 'E8ECF0',
  /** Özel satır (tatil, sınav) arka plan */
  SPECIAL_ROW_SHADE: 'FEF3C7',
  /** Satır çizgi rengi */
  BORDER_COLOR: '000000',
  /** Tablo kenarlık kalınlığı (1/8 pt) */
  BORDER_SIZE: 8,
  /** İç kenarlık kalınlığı */
  INNER_BORDER_SIZE: 6,
} as const;

export const HEADER_STYLES = {
  /** Üst başlık satırı yazı boyu (1/2 pt) */
  HEADER_SIZE: 16, // 8pt
  /** Dar sütun başlık boyu */
  HEADER_SIZE_NARROW: 14, // 7pt
  /** Hücre dış boşlukları */
  HEADER_MARGINS: { top: 50, bottom: 50, left: 50, right: 50 },
  /** Dikey metin sütun dış boşlukları */
  VERTICAL_CELL_MARGINS: { top: 25, bottom: 25, left: 25, right: 25 },
} as const;

export const CELL_STYLES = {
  /** Standart hücre yazı boyu (1/2 pt) */
  CELL_SIZE: 14, // 7pt
  /** Küçük hücre yazı boyu */
  CELL_SIZE_SMALL: 12, // 6pt
  /** Varsayılan hücre yüksekliği */
  DEFAULT_ROW_HEIGHT: 450,
  /** Büyük içerikli satır yüksekliği */
  LARGE_CONTENT_HEIGHT: 700,
} as const;

export const TABLE_LAYOUT = {
  /** Sayfa başına düşen satır sayısı (ara sayfalar) */
  ROWS_PER_PAGE: 15,
  /** Son sayfadaki minimum satır */
  ROWS_LAST_PAGE: 11,
  /** Minimum görünür satır */
  MIN_ROWS: 4,
  /** Sütun genişlikleri (twips) - MEB yıllık plan şablonu ile uyumlu */
  COL_WIDTHS: [240, 260, 220, 280, 360, 1000, 600, 2180, 400, 350, 420, 450, 650, 700],
} as const;

export const TEXT_STYLES = {
  FONT: 'Calibri',
  EMPTY_PLACEHOLDER: '–',
} as const;

export const ORIENTATION = {
  PAGE_WIDTH: 11906,
  PAGE_HEIGHT: 16838,
  MARGIN_TOP: 0.35,
  MARGIN_BOTTOM: 0.35,
  MARGIN_LEFT: 0.3,
  MARGIN_RIGHT: 0.3,
} as const;
