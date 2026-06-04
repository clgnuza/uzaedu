import '../models/optik_models.dart';
import 'api_client.dart';
import 'batch_scan_state.dart';
import 'offline_scan_queue.dart';

bool _isNetworkError(Object e) {
  final m = e.toString().toLowerCase();
  return m.contains('socket') ||
      m.contains('connection') ||
      m.contains('network') ||
      m.contains('failed host') ||
      m.contains('timeout');
}

class OptikRepository {
  OptikRepository(this._api);

  final ApiClient _api;
  final _offline = OfflineScanQueue();

  Future<bool> isReady() async {
    final j = await _api.getJson('/optik/status');
    return j['ready'] == true;
  }

  Future<List<ExamSessionSummary>> listSessions() async {
    final body = await _api.getBody('/optik/sessions');
    if (body is! List) return [];
    return body
        .map((e) => ExamSessionSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ExamSessionDetail> fetchSession(String sessionId) async {
    final j = await _api.getJson('/optik/sessions/$sessionId');
    return ExamSessionDetail.fromJson(j);
  }

  Future<SessionReportSummary> fetchSessionReport(String sessionId) async {
    final j = await _api.getJson('/optik/sessions/$sessionId/report');
    return SessionReportSummary.fromJson(j);
  }

  Future<List<ClassStudent>> fetchClassStudents(String classId) async {
    final body = await _api.getBody('/classes-subjects/classes/$classId/students');
    if (body is! List) return [];
    return body
        .map((e) => ClassStudent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<BatchScanState?> loadBatchState(String sessionId) async {
    final session = await fetchSession(sessionId);
    if (session.classId == null || session.classId!.isEmpty) return null;
    final students = await fetchClassStudents(session.classId!);
    if (students.isEmpty) return null;
    final report = await fetchSessionReport(sessionId);
    return BatchScanState(
      students: students,
      scannedIds: Set<String>.from(report.scannedStudentIds),
    );
  }

  Future<OmrScanLayout> fetchScanLayout(String templateId) async {
    final j = await _api.getJson('/optik/form-templates/$templateId/scan-layout');
    return OmrScanLayout.fromJson(j);
  }

  Future<OmrDecodeResult> decodeOmrAdvanced({
    required String templateId,
    required String imageBase64,
    int? maxQuestion,
  }) async {
    final j = await _api.postJson('/optik/decode-omr-advanced', {
      'templateId': templateId,
      'image': imageBase64,
      if (maxQuestion != null) 'maxQuestion': maxQuestion,
    });
    final result = j['result'] as Map<String, dynamic>? ?? j;
    return OmrDecodeResult.fromJson(result);
  }

  Future<String> ocr({
    required String imageBase64,
    required String kind,
  }) async {
    final j = await _api.postJson('/optik/ocr', {
      'image_base64': imageBase64,
      'language_hint': 'tr',
      'kind': kind,
    });
    return j['text'] as String? ?? '';
  }

  Map<String, dynamic> _sessionScanBody({
    required OptikScanIntent intent,
    required OmrDecodeResult? omr,
  }) {
    final answers = omr?.answers ?? {};
    final rows = answers.entries.map((e) => {'question': e.key, 'label': e.value}).toList();
    final ambiguous = omr?.perQuestion.where((p) => p.ambiguous).length ?? 0;
    return {
      'template_id': intent.templateId,
      'template_name': intent.templateName ?? '',
      'kind': intent.isMc ? 'mc' : 'open',
      if (intent.studentId != null) 'student_id': intent.studentId,
      if (intent.studentLabel != null) 'student_label': intent.studentLabel,
      if (intent.classId != null) 'class_id': intent.classId,
      if (intent.className != null) 'class_name': intent.className,
      if (intent.subjectId != null) 'subject_id': intent.subjectId,
      if (intent.subjectName != null) 'subject_name': intent.subjectName,
      'answers': rows,
      'ambiguous_count': ambiguous,
      'confidence': omr?.confidence,
      'anchor_score': omr?.anchorScore,
    };
  }

  Future<bool> submitSessionScan({
    required String sessionId,
    required OptikScanIntent intent,
    required OmrDecodeResult? omr,
    String? ocrText,
  }) async {
    final path = '/optik/sessions/$sessionId/scans';
    final body = _sessionScanBody(intent: intent, omr: omr);
    try {
      await _api.postJson(path, body);
      return true;
    } catch (e) {
      if (!_isNetworkError(e)) rethrow;
      await _offline.enqueue(PendingScanRequest.create(path: path, body: body));
      return false;
    }
  }

  Future<bool> submitFreeScan({
    required OptikScanIntent intent,
    required OmrDecodeResult? omr,
  }) async {
    const path = '/optik/scan-results';
    final answers = omr?.answers ?? {};
    final rows = answers.entries.map((e) => {'question': e.key, 'label': e.value}).toList();
    final body = {
      'template_id': intent.templateId,
      'template_name': intent.templateName ?? '',
      'kind': intent.isMc ? 'mc' : 'open',
      'answers': rows,
      'confidence': omr?.confidence,
      'anchor_score': omr?.anchorScore,
      'ambiguous_count': omr?.perQuestion.where((p) => p.ambiguous).length ?? 0,
      if (intent.classId != null) 'class_id': intent.classId,
      if (intent.className != null) 'class_name': intent.className,
      if (intent.studentId != null) 'student_id': intent.studentId,
      if (intent.studentLabel != null) 'student_label': intent.studentLabel,
    };
    try {
      await _api.postJson(path, body);
      return true;
    } catch (e) {
      if (!_isNetworkError(e)) rethrow;
      await _offline.enqueue(PendingScanRequest.create(path: path, body: body));
      return false;
    }
  }

  Future<void> submitOmrFeedback({
    required String templateId,
    required List<Map<String, dynamic>> corrections,
    String? scanResultId,
    String? studentCode,
  }) async {
    if (corrections.isEmpty) return;
    await _api.postJson('/optik/feedback/omr-corrections', {
      'template_id': templateId,
      if (scanResultId != null) 'scan_result_id': scanResultId,
      if (studentCode != null && studentCode.isNotEmpty) 'student_code': studentCode,
      'corrections': corrections,
    });
  }

  ClassStudent? matchStudentByCode(List<ClassStudent> students, String? code) {
    if (code == null || code.length < 3) return null;
    final norm = code.replaceAll(RegExp(r'\D'), '');
    if (norm.isEmpty) return null;
    for (final s in students) {
      final sn = s.studentNumber?.replaceAll(RegExp(r'\D'), '') ?? '';
      if (sn.isNotEmpty && (sn == norm || sn.endsWith(norm) || norm.endsWith(sn))) {
        return s;
      }
    }
    return null;
  }

  Future<void> patchSessionAnswerKey({
    required String sessionId,
    required Map<int, String> answers,
  }) async {
    final key = <String, String>{};
    answers.forEach((q, l) => key['$q'] = l);
    await _api.patchJson('/optik/sessions/$sessionId/answer-key', {
      'answer_key': key,
    });
  }
}
