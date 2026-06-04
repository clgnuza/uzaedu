import '../models/optik_models.dart';

OptikScanIntent? parseOptikScanUri(Uri? uri) {
  if (uri == null) return null;
  if (uri.scheme != 'uzaedu' || uri.host != 'optik') return null;
  final path = uri.path.replaceFirst('/', '');
  if (path != 'scan' && path.isNotEmpty && !path.endsWith('scan')) return null;
  final q = uri.queryParameters;
  final templateId = q['template_id']?.trim();
  final mode = q['mode']?.trim();
  if (templateId == null || templateId.isEmpty || mode == null || mode.isEmpty) {
    return null;
  }
  final batch = q['batch'] == '1' || q['batch'] == 'true';
  return OptikScanIntent(
    templateId: templateId,
    mode: mode,
    sessionId: q['session_id'],
    templateName: q['template_name'],
    classId: q['class_id'],
    className: q['class_name'],
    subjectId: q['subject_id'],
    subjectName: q['subject_name'],
    studentId: q['student_id'],
    studentLabel: q['student_label'],
    batchMode: batch,
  );
}

String modeTitle(String mode) {
  switch (mode) {
    case 'mc_student':
      return 'Öğrenci optik formu';
    case 'mc_key':
      return 'Anahtar optik formu';
    case 'open_key':
      return 'Anahtar / rubrik OCR';
    case 'open_student':
      return 'Öğrenci cevabı OCR';
    default:
      return mode;
  }
}
