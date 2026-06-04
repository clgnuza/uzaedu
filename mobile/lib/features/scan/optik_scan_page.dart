import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../models/optik_models.dart';
import '../../services/api_client.dart';
import '../../services/camera_guidance.dart';
import '../../services/deep_link_service.dart';
import '../../services/image_capture.dart';
import '../../services/ocr_service.dart';
import '../../services/omr_burst_decoder.dart';
import '../../services/omr_frame_enhance.dart';
import '../../services/omr_image_quality.dart';
import '../../services/omr_live_guidance.dart';
import '../../services/batch_scan_state.dart';
import '../../services/optik_repository.dart';
import 'mc_scan_review_sheet.dart';
import 'optik_scan_guidance_banner.dart';

class OptikScanPage extends StatefulWidget {
  const OptikScanPage({super.key, required this.token, required this.intent});

  final String token;
  final OptikScanIntent intent;

  @override
  State<OptikScanPage> createState() => _OptikScanPageState();
}

class _OptikScanPageState extends State<OptikScanPage> {
  CameraController? _camera;
  late final OptikRepository _repo = OptikRepository(ApiClient(widget.token));
  late OptikScanIntent _intent = widget.intent;
  BatchScanState? _batch;
  List<ClassStudent> _classStudents = [];
  OmrLiveGuidance? _liveGuidance;
  bool _busy = false;
  String? _status;
  OmrDecodeResult? _pendingOmr;
  CameraGuidance? _guidance;
  int? _maxQuestion;
  int _choiceCount = 5;
  bool _torchOn = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await Future.wait([_initCamera(), _loadLayout(), _loadBatch(), _loadClassStudents()]);
  }

  Future<void> _loadClassStudents() async {
    if (_intent.classId == null || _intent.classId!.isEmpty) return;
    try {
      final list = await _repo.fetchClassStudents(_intent.classId!);
      if (mounted) setState(() => _classStudents = list);
    } catch (_) {}
  }

  Future<void> _loadBatch() async {
    if (!_intent.batchMode || _intent.sessionId == null) return;
    try {
      var batch = await _repo.loadBatchState(_intent.sessionId!);
      if (batch == null) return;
      if (_intent.studentId != null) {
        ClassStudent? st;
        for (final s in batch.students) {
          if (s.id == _intent.studentId) {
            st = s;
            break;
          }
        }
        if (st != null) {
          if (mounted) {
            setState(() {
              _batch = batch;
              _intent = _intent.copyWith(studentLabel: st.name);
            });
          }
          return;
        }
      }
      final cur = batch.current;
      if (cur != null && mounted) {
        setState(() {
          _batch = batch;
          _intent = _intent.copyWith(studentId: cur.id, studentLabel: cur.name);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadLayout() async {
    try {
      final layout = await _repo.fetchScanLayout(widget.intent.templateId);
      if (!mounted) return;
      setState(() => _maxQuestion = layout.questionCount);
    } catch (_) {}
  }

  Future<void> _initCamera() async {
    final cams = await availableCameras();
    final back = cams.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.back,
      orElse: () => cams.first,
    );
    final ctrl = CameraController(
      back,
      ResolutionPreset.max,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    await ctrl.initialize();
    try {
      await ctrl.setFocusMode(FocusMode.auto);
      await ctrl.setExposureMode(ExposureMode.auto);
    } catch (_) {}
    if (!mounted) return;

    if (_intent.isMc) {
      _liveGuidance?.detach();
      _liveGuidance = OmrLiveGuidance(
        repo: _repo,
        templateId: _intent.templateId,
        maxQuestion: _maxQuestion,
        onGuidance: (g) {
          if (mounted) setState(() => _guidance = g);
        },
      )..attach(ctrl);
    }

    setState(() => _camera = ctrl);
  }

  @override
  void dispose() {
    _liveGuidance?.detach();
    _camera?.dispose();
    super.dispose();
  }

  Future<void> _toggleTorch() async {
    final cam = _camera;
    if (cam == null || !cam.value.isInitialized) return;
    final next = !_torchOn;
    try {
      await cam.setFlashMode(next ? FlashMode.torch : FlashMode.off);
      setState(() => _torchOn = next);
    } catch (_) {}
  }

  Future<bool> _confirmPoorQuality(OmrImageQuality q) async {
    if (!mounted) return false;
    final go = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Görüntü kalitesi düşük'),
        content: Text(q.message ?? 'Yeniden çekmeniz önerilir'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('İptal')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yine de devam')),
        ],
      ),
    );
    return go == true;
  }

  Future<void> _captureMc() async {
    final cam = _camera;
    if (cam == null || !cam.value.isInitialized) return;
    _liveGuidance?.detach();

    setState(() {
      _busy = true;
      _status = 'Kalite kontrolü…';
      _pendingOmr = null;
    });

    try {
      final frames = <String>[];
      final probe = await cam.takePicture();
      final quality = await assessOmrImageQualityFromPath(probe.path);
      if (!quality.ok) {
        final cont = await _confirmPoorQuality(quality);
        if (!cont) {
          if (mounted) {
            setState(() {
              _busy = false;
              _status = quality.message;
            });
            _liveGuidance?.attach(cam);
          }
          return;
        }
      }
      frames.add(await enhanceOmrDataUrl(await xFileToDataUrl(probe)));

      for (var i = 1; i < kMcBurstFrameCount; i++) {
        await Future<void>.delayed(kBurstFrameDelay);
        if (!mounted) return;
        setState(() => _status = 'Kare ${i + 1}/$kMcBurstFrameCount');
        final file = await cam.takePicture();
        final q = await assessOmrImageQualityFromPath(file.path);
        if (!q.ok) continue;
        frames.add(await enhanceOmrDataUrl(await xFileToDataUrl(file)));
      }

      if (frames.isEmpty) {
        throw StateError('Hiç uygun kare alınamadı — ışık ve sabitlik');
      }

      setState(() => _status = 'OpenCV OMR…');
      final outcome = await decodeOmrBurstFromFrames(
        repo: _repo,
        templateId: _intent.templateId,
        frameDataUrls: frames,
        maxQuestion: _maxQuestion,
      );

      if (!mounted) return;
      setState(() {
        _pendingOmr = outcome.result;
        _busy = false;
        _status =
            '${outcome.frameCount} kare · güven %${(outcome.result.confidence * 100).round()}';
      });
      await _showMcReview(outcome.result);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = e.toString();
        _busy = false;
      });
    } finally {
      if (mounted && _intent.isMc) _liveGuidance?.attach(cam);
    }
  }

  Future<void> _showMcReview(OmrDecodeResult result) async {
    final confirmed = await showModalBottomSheet<OmrDecodeResult>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => McScanReviewSheet(
        result: result,
        maxQuestion: _maxQuestion ?? result.answers.length,
        choiceCount: _choiceCount,
        onRetry: () => Navigator.pop(ctx),
        onConfirm: (r) => Navigator.pop(ctx, r),
      ),
    );
    if (confirmed != null && mounted) {
      await _applyStudentCodeMatch(confirmed);
      setState(() => _pendingOmr = confirmed);
      await _submit(omr: confirmed, original: result);
    }
  }

  Future<void> _applyStudentCodeMatch(OmrDecodeResult decoded) async {
    final code = decoded.studentCode;
    if (code == null || code.isEmpty || _classStudents.isEmpty) return;
    final match = _repo.matchStudentByCode(_classStudents, code);
    if (match != null && mounted) {
      setState(() {
        _intent = _intent.copyWith(studentId: match.id, studentLabel: match.name);
      });
    }
  }

  List<Map<String, dynamic>> _collectCorrections(
    OmrDecodeResult original,
    OmrDecodeResult finalResult,
  ) {
    final rows = <Map<String, dynamic>>[];
    for (final p in finalResult.perQuestion) {
      OmrPerQuestion? orig;
      for (final x in original.perQuestion) {
        if (x.question == p.question) {
          orig = x;
          break;
        }
      }
      final detected = orig?.label ?? '';
      if (detected != p.label && p.label.isNotEmpty) {
        rows.add({
          'question': p.question,
          'detected_label': detected.isEmpty ? '-' : detected,
          'corrected_label': p.label,
        });
      }
    }
    return rows;
  }

  Future<void> _captureOcr() async {
    final cam = _camera;
    if (cam == null || !cam.value.isInitialized) return;
    setState(() {
      _busy = true;
      _status = 'OCR…';
    });
    try {
      final file = await cam.takePicture();
      final q = await assessOmrImageQualityFromPath(file.path);
      if (!q.ok) {
        final cont = await _confirmPoorQuality(q);
        if (!cont) {
          setState(() {
            _busy = false;
            _status = q.message;
          });
          return;
        }
      }
      var text = await recognizeTextFromFile(file.path);
      if (text.length < 8) {
        final dataUrl = await xFileToDataUrl(file);
        text = await _repo.ocr(imageBase64: dataUrl, kind: _intent.ocrKind);
      }
      if (!mounted) return;
      setState(() {
        _status = text.isEmpty ? 'Metin okunamadı' : '${text.length} karakter';
        _busy = false;
      });
      if (text.isNotEmpty) await _submit(ocrText: text);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = e.toString();
        _busy = false;
      });
    }
  }

  Future<void> _submit({
    OmrDecodeResult? omr,
    String? ocrText,
    OmrDecodeResult? original,
  }) async {
    final decoded = omr ?? _pendingOmr;
    if (decoded == null && (ocrText == null || ocrText.isEmpty)) return;
    setState(() {
      _busy = true;
      _status = 'Kaydediliyor…';
    });
    try {
      var sentOnline = true;
      if (original != null && decoded != null) {
        final corrections = _collectCorrections(original, decoded);
        if (corrections.isNotEmpty) {
          try {
            await _repo.submitOmrFeedback(
              templateId: _intent.templateId,
              corrections: corrections,
              studentCode: decoded.studentCode,
            );
          } catch (_) {}
        }
      }

      if (_intent.mode == 'mc_key' && decoded != null && _intent.sessionId != null) {
        await _repo.patchSessionAnswerKey(
          sessionId: _intent.sessionId!,
          answers: decoded.answers,
        );
      } else if (_intent.sessionId != null) {
        sentOnline = await _repo.submitSessionScan(
          sessionId: _intent.sessionId!,
          intent: _intent,
          omr: decoded,
          ocrText: ocrText,
        );
      } else if (decoded != null) {
        sentOnline = await _repo.submitFreeScan(intent: _intent, omr: decoded);
      }

      if (_batch != null && _intent.studentId != null) {
        _batch!.markScanned(_intent.studentId!);
      }

      if (!mounted) return;
      final msg = sentOnline
          ? 'Kaydedildi'
          : 'Çevrimdışı kuyruğa alındı — ağ gelince gönderilir';

      if (_intent.batchMode && _batch != null && !_batch!.isComplete) {
        final next = _batch!.current;
        if (next != null) {
          setState(() {
            _intent = _intent.copyWith(studentId: next.id, studentLabel: next.name);
            _pendingOmr = null;
            _busy = false;
            _status = '$msg · sıradaki: ${next.name}';
          });
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
          return;
        }
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_batch?.isComplete == true ? '$msg · sınıf bitti' : msg)),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = e.toString();
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cam = _camera;
    final isMc = _intent.isMc;
    final canScan = !_busy && (isMc ? (_guidance?.ready ?? false) : true);
    final batch = _batch;

    return Scaffold(
      appBar: AppBar(
        title: Text(modeTitle(_intent.mode)),
        actions: [
          if (cam != null)
            IconButton(
              icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
              onPressed: _busy ? null : _toggleTorch,
            ),
        ],
      ),
      body: Column(
        children: [
          if (batch != null)
            LinearProgressIndicator(
              value: batch.progress,
              minHeight: 4,
            ),
          if (batch != null && _intent.studentLabel != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Text(
                'Toplu ${batch.doneCount}/${batch.total} · ${_intent.studentLabel}',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          if (isMc) OptikScanGuidanceBanner(guidance: _guidance),
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (cam == null || !cam.value.isInitialized)
                  const Center(child: CircularProgressIndicator())
                else
                  ClipRect(
                    child: OverflowBox(
                      alignment: Alignment.center,
                      child: FittedBox(
                        fit: BoxFit.cover,
                        child: SizedBox(
                          width: cam.value.previewSize?.height ?? 1,
                          height: cam.value.previewSize?.width ?? 1,
                          child: CameraPreview(cam),
                        ),
                      ),
                    ),
                  ),
                if (isMc)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: (_guidance?.ready ?? false)
                                ? Colors.greenAccent
                                : Colors.white54,
                            width: 2,
                          ),
                        ),
                        child: const SizedBox(width: 280, height: 380),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (_status != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Text(_status!, style: const TextStyle(fontSize: 12)),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: FilledButton.icon(
              onPressed: canScan ? () => isMc ? _captureMc() : _captureOcr() : null,
              icon: const Icon(Icons.camera),
              label: Text(isMc ? 'Tara ($kMcBurstFrameCount kare)' : 'OCR çek'),
            ),
          ),
        ],
      ),
    );
  }
}
