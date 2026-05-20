import { toast } from 'sonner';

export type ScheduleResult = {
  assigned?: number;
  total?: number;
  unassigned?: number;
  conflicts?: number;
  timeConflicts?: number;
  sessionsCreated?: number;
  missingSubjects?: string[];
  capacityShortfall?: string[];
  messages?: string[];
};

export function toastScheduleResult(res: ScheduleResult, prefix?: string) {
  const p = prefix ? `${prefix}: ` : '';
  const total = res.total ?? 0;
  const assigned = res.assigned ?? 0;
  const unassigned = res.unassigned ?? res.conflicts ?? 0;
  const timeConflicts = res.timeConflicts ?? 0;
  const ok = total > 0 && assigned === total && unassigned === 0 && timeConflicts === 0;

  const text =
    res.messages?.filter(Boolean).join(' ') ||
    (total === 0
      ? 'Atanacak sorumlu ders yok.'
      : ok
        ? `Tüm sorumlu dersler atandı (${assigned}/${total}). Zaman çakışması yok.`
        : `${assigned}/${total} ders atandı.${unassigned > 0 ? ` ${unassigned} atanamadı.` : ''}${timeConflicts > 0 ? ` ${timeConflicts} öğrencide çakışma.` : ''}`);

  if (ok) toast.success(p + text);
  else if (unassigned > 0 || timeConflicts > 0 || (res.missingSubjects?.length ?? 0) > 0) toast.warning(p + text);
  else toast.info(p + text);

  if ((res.sessionsCreated ?? 0) > 0 && !text.includes('ek oturum')) {
    toast.info(`${res.sessionsCreated} ek oturum kapasite için açıldı.`);
  }
}
