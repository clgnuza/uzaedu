import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:ogretmenpro_optik/services/omr_frame_enhance.dart';

void main() {
  test('enhanceOmrDataUrl returns valid jpeg data url', () async {
    final src = img.Image(width: 40, height: 60);
    for (var y = 0; y < src.height; y++) {
      for (var x = 0; x < src.width; x++) {
        src.setPixel(x, y, img.ColorRgb8(180, 180, 180));
      }
    }
    final b64 = base64Encode(img.encodeJpg(src));
    final url = 'data:image/jpeg;base64,$b64';
    final out = await enhanceOmrDataUrl(url);
    expect(out.startsWith('data:image/jpeg;base64,'), isTrue);
    expect(out.length, greaterThan(url.length ~/ 2));
  });
}
