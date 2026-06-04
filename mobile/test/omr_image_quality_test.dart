import 'package:flutter_test/flutter_test.dart';
import 'package:ogretmenpro_optik/services/omr_image_quality.dart';

void main() {
  test('laplacianVariance sharp vs flat', () {
    const w = 40;
    const h = 40;
    final flat = List<int>.filled(w * h, 128);
    final sharp = List<int>.generate(w * h, (i) {
      final x = i % w;
      final y = i ~/ w;
      return (128 + x * 3 + y * 5 + (x * y) % 17).clamp(0, 255);
    });
    expect(laplacianVariance(flat, w, h), lessThan(5));
    expect(laplacianVariance(sharp, w, h), greaterThan(50));
  });

  test('threshold constants match PWA', () {
    expect(kMinBrightness, 72);
    expect(kMaxBrightness, 238);
    expect(kMinBlurVariance, 28);
  });
}
