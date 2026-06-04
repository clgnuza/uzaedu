import 'package:flutter_test/flutter_test.dart';
import 'package:ogretmenpro_optik/models/optik_models.dart';
import 'package:ogretmenpro_optik/services/omr_burst_decoder.dart';

void main() {
  test('mergeOmrResults majority vote', () {
    final a = OmrDecodeResult(
      answers: {1: 'A', 2: 'B'},
      confidence: 0.8,
      needsRescan: false,
      perQuestion: [
        OmrPerQuestion(question: 1, label: 'A', ambiguous: false),
        OmrPerQuestion(question: 2, label: 'B', ambiguous: false),
      ],
      studentCode: '12345',
      studentCodeConfidence: 0.7,
    );
    final b = OmrDecodeResult(
      answers: {1: 'A', 2: 'C'},
      confidence: 0.75,
      needsRescan: false,
      perQuestion: [
        OmrPerQuestion(question: 1, label: 'A', ambiguous: false),
        OmrPerQuestion(question: 2, label: 'C', ambiguous: false),
      ],
      studentCode: '12345',
      studentCodeConfidence: 0.9,
    );
    final b2 = OmrDecodeResult(
      answers: {1: 'A', 2: 'B'},
      confidence: 0.7,
      needsRescan: false,
      perQuestion: [
        OmrPerQuestion(question: 1, label: 'A', ambiguous: false),
        OmrPerQuestion(question: 2, label: 'B', ambiguous: false),
      ],
      studentCode: '99999',
      studentCodeConfidence: 0.6,
    );
    final m = mergeOmrResults([a, b, b2]);
    expect(m.answers[1], 'A');
    expect(m.answers[2], 'B');
    expect(m.studentCode, '12345');
  });
}
