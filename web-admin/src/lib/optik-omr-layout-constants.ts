/** Backend optik-omr-geometry.ts ile senkron — PDF + scan-layout */

export const OMR_LAYOUT_VERSION = 'omr-v4';
export const OMR_PAGE_WIDTH = 595.28;
export const OMR_PAGE_HEIGHT = 841.89;

export function isCurrentOmrLayout(layout: { version?: string; bubbles?: unknown[] } | null): boolean {
  return layout?.version === OMR_LAYOUT_VERSION && Array.isArray(layout.bubbles) && layout.bubbles.length > 0;
}
