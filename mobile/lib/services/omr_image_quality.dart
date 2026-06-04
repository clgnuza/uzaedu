import 'dart:io';
import 'dart:math' as math;

import 'package:image/image.dart' as img;

/// PWA `optik-omr-quality.ts` ile aynı eşikler
class OmrImageQuality {
  OmrImageQuality({
    required this.ok,
    required this.blurScore,
    required this.brightness,
    this.message,
  });

  final bool ok;
  final double blurScore;
  final double brightness;
  final String? message;
}

const double kMinBrightness = 72;
const double kMaxBrightness = 238;
const double kMinBlurVariance = 28;

double laplacianVariance(List<int> gray, int w, int h) {
  var sum = 0.0;
  var sum2 = 0.0;
  var n = 0;
  for (var y = 1; y < h - 1; y++) {
    for (var x = 1; x < w - 1; x++) {
      final c = gray[y * w + x];
      final lap = (4 * c -
              gray[y * w + (x - 1)] -
              gray[y * w + (x + 1)] -
              gray[(y - 1) * w + x] -
              gray[(y + 1) * w + x])
          .abs();
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  if (n < 1) return 0;
  final mean = sum / n;
  return sum2 / n - mean * mean;
}

Future<OmrImageQuality> assessOmrImageQualityFromPath(String path) async {
  final bytes = await File(path).readAsBytes();
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    return OmrImageQuality(
      ok: false,
      blurScore: 0,
      brightness: 0,
      message: 'Görüntü okunamadı',
    );
  }

  const maxW = 320;
  final scale = math.min(1.0, maxW / decoded.width);
  final w = math.max(1, (decoded.width * scale).round());
  final h = math.max(1, (decoded.height * scale).round());
  final thumb = img.copyResize(decoded, width: w, height: h);

  final gray = List<int>.generate(w * h, (i) {
    final p = thumb.getPixel(i % w, i ~/ w);
    return ((0.299 * p.r + 0.587 * p.g + 0.114 * p.b).round());
  });

  var bright = 0.0;
  for (final v in gray) {
    bright += v;
  }
  final brightness = bright / gray.length;
  final blurScore = laplacianVariance(gray, w, h);

  if (brightness < kMinBrightness) {
    return OmrImageQuality(
      ok: false,
      blurScore: blurScore,
      brightness: brightness,
      message: 'Görüntü çok karanlık — flaş veya ışık artırın',
    );
  }
  if (brightness > kMaxBrightness) {
    return OmrImageQuality(
      ok: false,
      blurScore: blurScore,
      brightness: brightness,
      message: 'Görüntü aşırı parlak — gölge/refleksiyon azaltın',
    );
  }
  if (blurScore < kMinBlurVariance) {
    return OmrImageQuality(
      ok: false,
      blurScore: blurScore,
      brightness: brightness,
      message: 'Görüntü bulanık — telefonu sabit tutup yeniden çekin',
    );
  }
  return OmrImageQuality(
    ok: true,
    blurScore: blurScore,
    brightness: brightness,
  );
}
