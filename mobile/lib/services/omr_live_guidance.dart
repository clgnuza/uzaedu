import 'dart:async';

import 'package:camera/camera.dart';

import 'camera_guidance.dart';
import 'image_capture.dart';
import 'omr_image_quality.dart';
import 'optik_repository.dart';

/// Canlı rehber — ~3 sn’de bir düşük maliyetli önizleme (anchor + ışık) */
class OmrLiveGuidance {
  OmrLiveGuidance({
    required this.repo,
    required this.templateId,
    this.maxQuestion,
    this.onGuidance,
  });

  final OptikRepository repo;
  final String templateId;
  final int? maxQuestion;
  final void Function(CameraGuidance guidance)? onGuidance;

  Timer? _timer;
  bool _tickBusy = false;
  CameraController? _camera;

  static const Duration interval = Duration(milliseconds: 3000);

  void attach(CameraController camera) {
    _camera = camera;
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => unawaited(_tick()));
  }

  void detach() {
    _timer?.cancel();
    _timer = null;
    _camera = null;
  }

  Future<void> _tick() async {
    final cam = _camera;
    if (_tickBusy || cam == null || !cam.value.isInitialized) return;
    _tickBusy = true;
    try {
      final file = await cam.takePicture();
      final quality = await assessOmrImageQualityFromPath(file.path);
      double? anchor;
      if (quality.ok) {
        try {
          final dataUrl = await xFileToDataUrl(file);
          final decoded = await repo.decodeOmrAdvanced(
            templateId: templateId,
            imageBase64: dataUrl,
            maxQuestion: maxQuestion,
          );
          anchor = decoded.anchorScore;
        } catch (_) {
          anchor = null;
        }
      }
      onGuidance?.call(
        assessCameraGuidance(
          brightness: quality.brightness,
          anchorScore: anchor,
        ),
      );
    } finally {
      _tickBusy = false;
    }
  }
}

void unawaited(Future<void> f) {
  f.catchError((_) {});
}
