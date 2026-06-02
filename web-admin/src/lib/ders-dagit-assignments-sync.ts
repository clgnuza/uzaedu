/** Atama listesi değişince (sil/ekle) diğer stüdyo sayfaları yenilensin */

import { invalidateStudioValidationCache } from '@/hooks/use-studio-validation';

export const DERS_DAGIT_ASSIGNMENTS_CHANGED = 'ders-dagit:assignments-changed';

export type AssignmentsChangedDetail = { studioId?: string };

export function notifyDersDagitAssignmentsChanged(studioId?: string) {
  if (typeof window === 'undefined') return;
  invalidateStudioValidationCache(studioId);
  window.dispatchEvent(
    new CustomEvent<AssignmentsChangedDetail>(DERS_DAGIT_ASSIGNMENTS_CHANGED, {
      detail: { studioId },
    }),
  );
}
