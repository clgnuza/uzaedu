/**
 * Haber listeleri: giriş yoksa JWT gerektirmeyen /content/public/* uçları.
 */
export function contentReadPath(
  segment: 'channels' | 'meb-sources' | 'items',
  token: string | null | undefined,
): string {
  const base = token ? '/content' : '/content/public';
  return `${base}/${segment}`;
}
