import { resolveDefaultApiBase } from './resolve-api-base';

function buildTeacherNotificationQuery(pdfTheme: string, teacherFilter?: string): string {
  const q = new URLSearchParams();
  if (pdfTheme) {
    const themeVal = pdfTheme.replace(/^theme=/, '');
    if (themeVal) q.set('theme', themeVal);
  }
  if (teacherFilter?.trim()) q.set('teacher', teacherFilter.trim());
  const s = q.toString();
  return s ? `?${s}` : '';
}

export type SchedulePrintView = 'class' | 'teacher' | 'room';

/** Kurum belgeleri — kapak / onay (backend PDF önizleme) */
export async function openInstitutionDocumentPdf(
  token: string,
  studioId: string,
  programId: string,
  doc: 'cover' | 'approval',
  printMode?: 'color' | 'bw',
): Promise<void> {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const q = new URLSearchParams();
  if (printMode) q.set('theme', printMode === 'bw' ? 'bw' : 'color');
  const qs = q.toString();
  const res = await fetch(
    `${base}/ders-dagit/studios/${studioId}/programs/${programId}/export/${doc}.pdf${qs ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `PDF açılamadı (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Pop-up engellendi; PDF önizlemesi açılamadı.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** Editör haftalık ızgara — backend PDF (raporlarla aynı şablon), yeni sekmede */
export async function openScheduleViewPdf(
  token: string,
  studioId: string,
  programId: string,
  view: SchedulePrintView,
  filter: string,
  label: string,
  printMode?: 'color' | 'bw',
): Promise<void> {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const q = new URLSearchParams({
    view,
    filter,
    label: label.trim() || filter,
  });
  if (printMode) q.set('theme', printMode === 'bw' ? 'bw' : 'color');
  const res = await fetch(
    `${base}/ders-dagit/studios/${studioId}/programs/${programId}/export/schedule.pdf?${q}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `PDF açılamadı (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) throw new Error('Pop-up engellendi; PDF açılamadı.');
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export async function downloadDersDagitExport(
  token: string,
  studioId: string,
  programId: string,
  kind:
    | 'csv'
    | 'eokul'
    | 'eokul_xlsx'
    | 'eokul_report'
    | 'pdf'
    | 'council_pdf'
    | 'parent_pdf'
    | 'master_teacher_pdf'
    | 'master_class_pdf'
    | 'master_room_pdf'
    | 'duty_pdf'
    | 'dual_education_pdf'
    | 'extra_lesson_pdf'
    | 'teacher_notification_pdf'
    | 'xlsx',
  section?: string,
  printMode?: 'color' | 'bw',
  teacherFilter?: string,
) {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const themeParam = printMode ? `theme=${printMode === 'bw' ? 'bw' : 'color'}` : '';
  const pdfTheme =
    themeParam &&
    (kind === 'pdf' ||
      kind === 'council_pdf' ||
      kind === 'parent_pdf' ||
      kind.startsWith('master_') ||
      kind === 'duty_pdf' ||
      kind === 'dual_education_pdf' ||
      kind === 'extra_lesson_pdf' ||
      kind === 'teacher_notification_pdf')
      ? themeParam
      : '';
  const path =
    kind === 'eokul'
      ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/eokul`
      : kind === 'eokul_xlsx'
        ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/eokul.xlsx`
        : kind === 'eokul_report'
          ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/eokul/report.csv`
          : kind === 'council_pdf'
            ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/council.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
            : kind === 'parent_pdf'
              ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/parent.pdf?section=${encodeURIComponent(section ?? '5A')}${pdfTheme ? `&${pdfTheme}` : ''}`
              : kind === 'master_teacher_pdf'
                ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/master-teacher.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
                : kind === 'master_class_pdf'
                  ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/master-class.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
                  : kind === 'master_room_pdf'
                    ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/master-room.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
                    : kind === 'duty_pdf'
                      ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/duty.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
                      : kind === 'dual_education_pdf'
                        ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/dual-education.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
                        : kind === 'extra_lesson_pdf'
                          ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/extra-lesson.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
                          : kind === 'teacher_notification_pdf'
                            ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/teacher-notification.pdf${buildTeacherNotificationQuery(pdfTheme, teacherFilter)}`
                            : kind === 'pdf'
                      ? `/ders-dagit/studios/${studioId}/programs/${programId}/export.pdf${pdfTheme ? `?${pdfTheme}` : ''}`
                : kind === 'xlsx'
                  ? `/ders-dagit/studios/${studioId}/programs/${programId}/export.xlsx`
                  : `/ders-dagit/studios/${studioId}/programs/${programId}/export.csv`;
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `İndirme başarısız (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    kind === 'eokul'
      ? `eokul-ders-dagit-${programId.slice(0, 8)}.csv`
      : kind === 'eokul_xlsx'
        ? `eokul-ders-dagit-${programId.slice(0, 8)}.xlsx`
        : kind === 'eokul_report'
          ? `eokul-rapor-${programId.slice(0, 8)}.csv`
          : kind === 'council_pdf'
            ? `kurul-${programId.slice(0, 8)}.pdf`
            : kind === 'parent_pdf'
              ? `veli-${(section ?? 'sinif').slice(0, 12)}.pdf`
              : kind === 'master_teacher_pdf'
                ? `carsaf-ogretmen-${programId.slice(0, 8)}.pdf`
                : kind === 'master_class_pdf'
                  ? `carsaf-sinif-${programId.slice(0, 8)}.pdf`
                  : kind === 'master_room_pdf'
                    ? `carsaf-derslik-${programId.slice(0, 8)}.pdf`
                    : kind === 'duty_pdf'
                      ? `nobet-${programId.slice(0, 8)}.pdf`
                      : kind === 'dual_education_pdf'
                        ? `ikili-egitim-${programId.slice(0, 8)}.pdf`
                        : kind === 'extra_lesson_pdf'
                          ? `ek-ders-${programId.slice(0, 8)}.pdf`
                          : kind === 'teacher_notification_pdf'
                            ? `ogretmen-teblig-${programId.slice(0, 8)}.pdf`
                            : kind === 'pdf'
                      ? `ders-dagit-${programId.slice(0, 8)}.pdf`
                : kind === 'xlsx'
                  ? `ders-dagit-${programId.slice(0, 8)}.xlsx`
                  : `ders-dagit-${programId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
