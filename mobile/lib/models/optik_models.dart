class OmrScanLayout {
  OmrScanLayout({
    required this.version,
    required this.questionCount,
    required this.bubbles,
  });

  final String version;
  final int questionCount;
  final List<OmrBubble> bubbles;

  factory OmrScanLayout.fromJson(Map<String, dynamic> j) {
    final bubbles = (j['bubbles'] as List<dynamic>? ?? [])
        .map((e) => OmrBubble.fromJson(e as Map<String, dynamic>))
        .toList();
    return OmrScanLayout(
      version: j['version'] as String? ?? '',
      questionCount: (j['question_count'] as num?)?.toInt() ?? bubbles.length,
      bubbles: bubbles,
    );
  }
}

class OmrBubble {
  OmrBubble({required this.question, required this.label});

  final int question;
  final String label;

  factory OmrBubble.fromJson(Map<String, dynamic> j) => OmrBubble(
        question: (j['question'] as num).toInt(),
        label: j['label'] as String? ?? '',
      );
}

class OmrDecodeResult {
  OmrDecodeResult({
    required this.answers,
    required this.confidence,
    required this.needsRescan,
    required this.perQuestion,
    this.anchorScore,
    this.studentCode,
    this.studentCodeConfidence,
  });

  final Map<int, String> answers;
  final double confidence;
  final bool needsRescan;
  final double? anchorScore;
  final String? studentCode;
  final double? studentCodeConfidence;
  final List<OmrPerQuestion> perQuestion;

  factory OmrDecodeResult.fromJson(Map<String, dynamic> j) {
    final raw = j['answers'] as Map<String, dynamic>? ?? {};
    final answers = <int, String>{};
    raw.forEach((k, v) {
      answers[int.parse(k)] = v.toString();
    });
    final pq = (j['per_question'] as List<dynamic>? ?? [])
        .map((e) => OmrPerQuestion.fromJson(e as Map<String, dynamic>))
        .toList();
    return OmrDecodeResult(
      answers: answers,
      confidence: (j['confidence'] as num?)?.toDouble() ?? 0,
      needsRescan: j['needs_rescan'] as bool? ?? false,
      anchorScore: (j['anchor_score'] as num?)?.toDouble(),
      studentCode: j['student_code'] as String?,
      studentCodeConfidence: (j['student_code_confidence'] as num?)?.toDouble(),
      perQuestion: pq,
    );
  }
}

class OmrPerQuestion {
  OmrPerQuestion({
    required this.question,
    required this.label,
    required this.ambiguous,
  });

  final int question;
  final String label;
  final bool ambiguous;

  factory OmrPerQuestion.fromJson(Map<String, dynamic> j) => OmrPerQuestion(
        question: (j['question'] as num).toInt(),
        label: j['label'] as String? ?? '',
        ambiguous: j['ambiguous'] as bool? ?? false,
      );
}

class ExamSessionSummary {
  ExamSessionSummary({
    required this.id,
    required this.title,
    required this.templateId,
    required this.templateName,
    required this.questionCount,
    this.classId,
    this.className,
  });

  final String id;
  final String title;
  final String templateId;
  final String templateName;
  final int questionCount;
  final String? classId;
  final String? className;

  factory ExamSessionSummary.fromJson(Map<String, dynamic> j) => ExamSessionSummary(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        templateId: j['templateId'] as String? ?? j['template_id'] as String? ?? '',
        templateName: j['templateName'] as String? ?? j['template_name'] as String? ?? '',
        questionCount: (j['questionCount'] as num?)?.toInt() ??
            (j['question_count'] as num?)?.toInt() ??
            0,
        classId: j['classId'] as String? ?? j['class_id'] as String?,
        className: j['className'] as String? ?? j['class_name'] as String?,
      );
}

class ClassStudent {
  ClassStudent({required this.id, required this.name, this.studentNumber});

  final String id;
  final String name;
  final String? studentNumber;

  factory ClassStudent.fromJson(Map<String, dynamic> j) => ClassStudent(
        id: j['id'] as String,
        name: (j['name'] as String? ?? j['full_name'] as String? ?? '').trim(),
        studentNumber: j['studentNumber'] as String? ?? j['student_number'] as String?,
      );
}

class ExamSessionDetail {
  ExamSessionDetail({
    required this.id,
    required this.title,
    required this.templateId,
    required this.templateName,
    required this.questionCount,
    required this.choiceCount,
    this.classId,
    this.className,
  });

  final String id;
  final String title;
  final String templateId;
  final String templateName;
  final int questionCount;
  final int choiceCount;
  final String? classId;
  final String? className;

  factory ExamSessionDetail.fromJson(Map<String, dynamic> j) => ExamSessionDetail(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        templateId: j['templateId'] as String? ?? j['template_id'] as String? ?? '',
        templateName: j['templateName'] as String? ?? j['template_name'] as String? ?? '',
        questionCount: (j['questionCount'] as num?)?.toInt() ??
            (j['question_count'] as num?)?.toInt() ??
            0,
        choiceCount: (j['choiceCount'] as num?)?.toInt() ??
            (j['choice_count'] as num?)?.toInt() ??
            5,
        classId: j['classId'] as String? ?? j['class_id'] as String?,
        className: j['className'] as String? ?? j['class_name'] as String?,
      );
}

class SessionReportSummary {
  SessionReportSummary({
    required this.missingStudentIds,
    required this.scannedStudentIds,
  });

  final List<String> missingStudentIds;
  final Set<String> scannedStudentIds;

  factory SessionReportSummary.fromJson(Map<String, dynamic> j) {
    final missing = (j['missing_student_ids'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList();
    final scanned = <String>{};
    final matrix = j['matrix'] as List<dynamic>? ?? [];
    for (final row in matrix) {
      final m = row as Map<String, dynamic>;
      final sid = m['student_id'] as String?;
      if (sid != null && sid.isNotEmpty) scanned.add(sid);
    }
    return SessionReportSummary(
      missingStudentIds: missing,
      scannedStudentIds: scanned,
    );
  }
}

class OptikScanIntent {
  OptikScanIntent({
    required this.templateId,
    required this.mode,
    this.sessionId,
    this.templateName,
    this.classId,
    this.className,
    this.subjectId,
    this.subjectName,
    this.studentId,
    this.studentLabel,
    this.batchMode = false,
  });

  final String templateId;
  final String mode;
  final String? sessionId;
  final String? templateName;
  final String? classId;
  final String? className;
  final String? subjectId;
  final String? subjectName;
  final String? studentId;
  final String? studentLabel;
  final bool batchMode;

  OptikScanIntent copyWith({
    String? studentId,
    String? studentLabel,
    bool? batchMode,
  }) =>
      OptikScanIntent(
        templateId: templateId,
        mode: mode,
        sessionId: sessionId,
        templateName: templateName,
        classId: classId,
        className: className,
        subjectId: subjectId,
        subjectName: subjectName,
        studentId: studentId ?? this.studentId,
        studentLabel: studentLabel ?? this.studentLabel,
        batchMode: batchMode ?? this.batchMode,
      );

  bool get isMc =>
      mode == 'mc_student' || mode == 'mc_key';
  bool get isOpen =>
      mode == 'open_key' || mode == 'open_student';
  String get ocrKind => mode == 'open_key' || mode == 'mc_key' ? 'KEY' : 'STUDENT';
}
