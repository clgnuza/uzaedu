/** Flutter optik uygulaması deep link (yönetim PWA’dan tarama başlatma). */

export type OptikNativeScanMode =
  | 'mc_student'
  | 'mc_key'
  | 'open_key'
  | 'open_student';

export type OptikNativeScanParams = {
  templateId: string;
  mode: OptikNativeScanMode;
  sessionId?: string;
  templateName?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  studentId?: string;
  studentLabel?: string;
  /** Sınıf sırası ile otomatik sonraki öğrenci */
  batch?: boolean;
};

const SCHEME = 'uzaedu';
const HOST = 'optik';
const PATH = 'scan';

export function buildOptikNativeScanUrl(params: OptikNativeScanParams): string {
  const q = new URLSearchParams();
  q.set('template_id', params.templateId);
  q.set('mode', params.mode);
  if (params.sessionId) q.set('session_id', params.sessionId);
  if (params.templateName) q.set('template_name', params.templateName);
  if (params.classId) q.set('class_id', params.classId);
  if (params.className) q.set('class_name', params.className);
  if (params.subjectId) q.set('subject_id', params.subjectId);
  if (params.subjectName) q.set('subject_name', params.subjectName);
  if (params.studentId) q.set('student_id', params.studentId);
  if (params.studentLabel) q.set('student_label', params.studentLabel);
  if (params.batch) q.set('batch', '1');
  return `${SCHEME}://${HOST}/${PATH}?${q.toString()}`;
}

/** Mağaza / APK yokken PWA fallback bilgisi */
export const OPTIK_NATIVE_APP_LABEL = 'Uzaedu Optik';

export function openOptikNativeScan(params: OptikNativeScanParams): void {
  if (typeof window === 'undefined') return;
  window.location.href = buildOptikNativeScanUrl(params);
}
