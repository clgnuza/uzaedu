import 'package:flutter/material.dart';

import '../../services/camera_guidance.dart';

class OptikScanGuidanceBanner extends StatelessWidget {
  const OptikScanGuidanceBanner({super.key, required this.guidance});

  final CameraGuidance? guidance;

  @override
  Widget build(BuildContext context) {
    final g = guidance;
    if (g == null) return const SizedBox.shrink();
    final color = g.ready ? Colors.green.shade700 : Colors.amber.shade800;
    return Material(
      color: color.withValues(alpha: 0.92),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Icon(
              g.ready ? Icons.check_circle_outline : Icons.info_outline,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                g.message,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
