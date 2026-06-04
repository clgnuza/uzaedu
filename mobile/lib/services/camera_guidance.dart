/// PWA `optik-camera-guidance.ts` — parlaklık + köşe skoru (anchor) */

class CameraGuidance {
  CameraGuidance({
    required this.ready,
    required this.lighting,
    required this.alignment,
    required this.message,
    required this.score,
  });

  final bool ready;
  final GuidanceLighting lighting;
  final GuidanceAlignment alignment;
  final String message;
  final double score;
}

enum GuidanceLighting { ok, dark, bright }

enum GuidanceAlignment { ok, noForm, lowAnchor }

CameraGuidance assessCameraGuidance({
  required double brightness,
  double? anchorScore,
}) {
  GuidanceLighting lighting = GuidanceLighting.ok;
  var lightMsg = '';
  if (brightness < 75) {
    lighting = GuidanceLighting.dark;
    lightMsg = 'Çok karanlık — daha fazla ışık';
  } else if (brightness > 235) {
    lighting = GuidanceLighting.bright;
    lightMsg = 'Çok parlak — refleksiyonu azaltın';
  }

  GuidanceAlignment alignment = GuidanceAlignment.ok;
  var alignMsg = '';
  if (anchorScore == null) {
    alignment = GuidanceAlignment.noForm;
    alignMsg = lightMsg.isEmpty ? 'Formu çerçeveye alın' : lightMsg;
    return CameraGuidance(
      ready: false,
      lighting: lighting,
      alignment: alignment,
      message: alignMsg,
      score: brightness >= 85 && brightness <= 225 ? 0.35 : 0.2,
    );
  }

  if (anchorScore < 0.8) {
    alignment = GuidanceAlignment.lowAnchor;
    alignMsg = 'Köşe kareleri görünmüyor — yaklaşın / düz tutun';
  }

  final lightScore = brightness >= 85 && brightness <= 225 ? 1.0 : 0.65;
  final anchorPart = anchorScore >= 0.85 ? 1.0 : anchorScore >= 0.8 ? 0.75 : 0.4;
  final score = (lightScore + anchorPart) / 2;

  final ready =
      lighting == GuidanceLighting.ok && alignment == GuidanceAlignment.ok;
  final message = alignMsg.isNotEmpty
      ? alignMsg
      : lightMsg.isNotEmpty
          ? lightMsg
          : ready
              ? 'Hazır — tara'
              : 'Ayarlayın';

  return CameraGuidance(
    ready: ready,
    lighting: lighting,
    alignment: alignment,
    message: message,
    score: score,
  );
}
