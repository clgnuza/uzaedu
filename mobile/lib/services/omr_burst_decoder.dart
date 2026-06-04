import '../models/optik_models.dart';
import 'optik_repository.dart';

const int kMcBurstFrameCount = 5;
const Duration kBurstFrameDelay = Duration(milliseconds: 450);

double scoreOmrFrame(OmrDecodeResult r) {
  final n = r.perQuestion.isEmpty ? 1 : r.perQuestion.length;
  final amb = r.perQuestion.where((p) => p.ambiguous).length / n;
  final anchor = r.anchorScore ?? 0;
  return anchor * 0.45 + r.confidence * 0.35 - amb * 0.35;
}

OmrDecodeResult mergeOmrResults(List<OmrDecodeResult> results) {
  if (results.isEmpty) {
    return OmrDecodeResult(
      answers: {},
      confidence: 0,
      needsRescan: true,
      perQuestion: [],
    );
  }
  if (results.length == 1) return results.first;

  final voteMap = <int, Map<String, int>>{};
  for (final r in results) {
    r.answers.forEach((q, lbl) {
      voteMap.putIfAbsent(q, () => {});
      voteMap[q]![lbl] = (voteMap[q]![lbl] ?? 0) + 1;
    });
  }

  final allQ = <int>{};
  for (final r in results) {
    for (final p in r.perQuestion) {
      allQ.add(p.question);
    }
  }

  final answers = <int, String>{};
  final perQuestion = <OmrPerQuestion>[];
  var ambiguousCount = 0;

  for (final q in allQ.toList()..sort()) {
    final votes = voteMap[q];
    if (votes == null || votes.isEmpty) {
      ambiguousCount++;
      perQuestion.add(OmrPerQuestion(question: q, label: '', ambiguous: true));
      continue;
    }
    final sorted = votes.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = sorted.first;
    final second = sorted.length > 1 ? sorted[1].value : 0;
    final ambiguous = top.value <= second;
    if (ambiguous) ambiguousCount++;
    answers[q] = ambiguous ? '' : top.key;
    perQuestion.add(OmrPerQuestion(
      question: q,
      label: ambiguous ? '' : top.key,
      ambiguous: ambiguous,
    ));
  }

  final avgConf =
      results.map((r) => r.confidence).reduce((a, b) => a + b) / results.length;
  final n = perQuestion.isEmpty ? 1 : perQuestion.length;
  return OmrDecodeResult(
    answers: answers,
    confidence: avgConf,
    needsRescan: ambiguousCount > (n * 0.12).floor().clamp(3, 999),
    perQuestion: perQuestion,
    anchorScore: results.map((r) => r.anchorScore ?? 0).reduce((a, b) => a > b ? a : b),
    studentCode: _pickStudentCode(results),
    studentCodeConfidence: _avgStudentCodeConfidence(results, _pickStudentCode(results)),
  );
}

class OmrBurstOutcome {
  OmrBurstOutcome({
    required this.result,
    required this.previewFrameBase64,
    required this.frameCount,
  });

  final OmrDecodeResult result;
  final String previewFrameBase64;
  final int frameCount;
}

/// PWA `decodeOmrBurstEnhanced` ile uyumlu: her kare sunucu OpenCV, sonra birleştir.
Future<OmrBurstOutcome> decodeOmrBurstFromFrames({
  required OptikRepository repo,
  required String templateId,
  required List<String> frameDataUrls,
  int? maxQuestion,
}) async {
  if (frameDataUrls.isEmpty) {
    throw StateError('Kare yok');
  }

  final decoded = <OmrDecodeResult>[];
  for (final frame in frameDataUrls) {
    decoded.add(await repo.decodeOmrAdvanced(
      templateId: templateId,
      imageBase64: frame,
      maxQuestion: maxQuestion,
    ));
  }

  if (decoded.length == 1) {
    final one = decoded.first;
    return OmrBurstOutcome(
      result: one,
      previewFrameBase64: frameDataUrls.first,
      frameCount: 1,
    );
  }

  final ranked = <({int idx, OmrDecodeResult r, double score})>[];
  for (var i = 0; i < decoded.length; i++) {
    ranked.add((idx: i, r: decoded[i], score: scoreOmrFrame(decoded[i])));
  }
  ranked.sort((a, b) => b.score.compareTo(a.score));
  final best = ranked.first;

  var merged = mergeOmrResults(decoded);
  for (final p in merged.perQuestion) {
    if (!p.ambiguous) continue;
    OmrPerQuestion? bp;
    for (final x in best.r.perQuestion) {
      if (x.question == p.question) {
        bp = x;
        break;
      }
    }
    if (bp != null && !bp.ambiguous && bp.label.isNotEmpty) {
      final fix = bp;
      merged.answers[p.question] = fix.label;
      final updated = merged.perQuestion.map((x) {
        if (x.question != p.question) return x;
        return OmrPerQuestion(question: x.question, label: fix.label, ambiguous: false);
      }).toList();
      merged = OmrDecodeResult(
        answers: {...merged.answers, p.question: fix.label},
        confidence: (merged.confidence + best.r.confidence) / 2,
        needsRescan: merged.needsRescan,
        perQuestion: updated,
        anchorScore: best.r.anchorScore ?? merged.anchorScore,
      );
    }
  }

  final amb = merged.perQuestion.where((p) => p.ambiguous).length;
  final n = merged.perQuestion.isEmpty ? 1 : merged.perQuestion.length;
  merged = OmrDecodeResult(
    answers: merged.answers,
    confidence: merged.confidence,
    needsRescan: amb > (n * 0.12).floor().clamp(3, 999) ||
        (best.r.needsRescan && amb > 0),
    perQuestion: merged.perQuestion,
    anchorScore: best.r.anchorScore ?? merged.anchorScore,
  );

  final studentCode = _pickStudentCode(decoded);
  final studentCodeConfidence = _avgStudentCodeConfidence(decoded, studentCode);
  merged = OmrDecodeResult(
    answers: merged.answers,
    confidence: merged.confidence,
    needsRescan: merged.needsRescan,
    perQuestion: merged.perQuestion,
    anchorScore: merged.anchorScore,
    studentCode: studentCode ?? merged.studentCode,
    studentCodeConfidence: studentCodeConfidence ?? merged.studentCodeConfidence,
  );

  return OmrBurstOutcome(
    result: merged,
    previewFrameBase64: frameDataUrls[best.idx],
    frameCount: frameDataUrls.length,
  );
}

String? _pickStudentCode(List<OmrDecodeResult> results) {
  final votes = <String, int>{};
  for (final r in results) {
    final c = r.studentCode?.trim();
    if (c == null || c.isEmpty) continue;
    votes[c] = (votes[c] ?? 0) + 1;
  }
  if (votes.isEmpty) return null;
  return votes.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
}

double? _avgStudentCodeConfidence(List<OmrDecodeResult> results, String? code) {
  if (code == null) return null;
  var sum = 0.0;
  var n = 0;
  for (final r in results) {
    if (r.studentCode != code) continue;
    final c = r.studentCodeConfidence;
    if (c == null) continue;
    sum += c;
    n++;
  }
  return n > 0 ? sum / n : null;
}
