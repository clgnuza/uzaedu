/** Giriş istemeden (admin shell ile) görüntülenebilen yollar */
export function isPublicAdminPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return (
    p === '/haberler' ||
    p === '/haberler/yayin' ||
    p === '/extra-lesson-calc' ||
    p === '/hesaplamalar' ||
    p === '/sinav-gorev-ucretleri'
  );
}
