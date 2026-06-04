import 'package:flutter_test/flutter_test.dart';
import 'package:ogretmenpro_optik/services/deep_link_service.dart';

void main() {
  test('parse optik deep link', () {
    final intent = parseOptikScanUri(
      Uri.parse(
        'uzaedu://optik/scan?template_id=abc&mode=mc_student&session_id=s1',
      ),
    );
    expect(intent, isNotNull);
    expect(intent!.templateId, 'abc');
    expect(intent.mode, 'mc_student');
    expect(intent.sessionId, 's1');
    expect(intent.batchMode, isFalse);
  });

  test('parse batch deep link', () {
    final intent = parseOptikScanUri(
      Uri.parse(
        'uzaedu://optik/scan?template_id=a&mode=mc_student&session_id=s&batch=1',
      ),
    );
    expect(intent!.batchMode, isTrue);
  });
}
