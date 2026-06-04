import 'package:flutter/material.dart';

import '../../models/optik_models.dart';

const _choices = ['A', 'B', 'C', 'D', 'E', 'F'];

class McScanReviewSheet extends StatefulWidget {
  const McScanReviewSheet({
    super.key,
    required this.result,
    required this.maxQuestion,
    this.choiceCount = 5,
    required this.onConfirm,
    required this.onRetry,
  });

  final OmrDecodeResult result;
  final int maxQuestion;
  final int choiceCount;
  final ValueChanged<OmrDecodeResult> onConfirm;
  final VoidCallback onRetry;

  @override
  State<McScanReviewSheet> createState() => _McScanReviewSheetState();
}

class _McScanReviewSheetState extends State<McScanReviewSheet> {
  late OmrDecodeResult _local = widget.result;

  List<int> get _ambiguous =>
      _local.perQuestion.where((p) => p.ambiguous).map((p) => p.question).toList();

  void _setAnswer(int q, String label) {
    setState(() {
      final answers = Map<int, String>.from(_local.answers)..[q] = label;
      final perQuestion = _local.perQuestion.map((p) {
        if (p.question != q) return p;
        return OmrPerQuestion(question: q, label: label, ambiguous: false);
      }).toList();
      _local = OmrDecodeResult(
        answers: answers,
        confidence: _local.confidence,
        needsRescan: false,
        perQuestion: perQuestion,
        anchorScore: _local.anchorScore,
        studentCode: _local.studentCode,
        studentCodeConfidence: _local.studentCodeConfidence,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final labels = _choices.take(widget.choiceCount.clamp(4, 6));
    final blocking = _ambiguous.isNotEmpty;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Ön izleme',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(
              '${_local.answers.length} şık · güven %${(_local.confidence * 100).round()}'
              '${_local.anchorScore != null ? ' · köşe %${(_local.anchorScore! * 100).round()}' : ''}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (_local.studentCode != null && _local.studentCode!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Öğrenci no: ${_local.studentCode}'
                  '${_local.studentCodeConfidence != null ? ' (%${(_local.studentCodeConfidence! * 100).round()})' : ''}',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            if (widget.result.needsRescan)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Material(
                  color: Colors.amber.shade100,
                  borderRadius: BorderRadius.circular(8),
                  child: const Padding(
                    padding: EdgeInsets.all(8),
                    child: Text(
                      'Kalite düşük — yeniden çekmeniz önerilir',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                ),
              ),
            if (blocking) ...[
              const SizedBox(height: 12),
              Text(
                'Belirsiz sorular (${_ambiguous.length}) — şık seçin',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.35,
                ),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _ambiguous.length,
                  itemBuilder: (_, i) {
                    final q = _ambiguous[i];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Text('S$q', style: const TextStyle(fontWeight: FontWeight.bold)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Wrap(
                              spacing: 6,
                              children: labels.map((l) {
                                return ChoiceChip(
                                  label: Text(l),
                                  selected: _local.answers[q] == l,
                                  onSelected: (_) => _setAnswer(q, l),
                                );
                              }).toList(),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: widget.onRetry,
                    child: const Text('Yeniden çek'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: blocking ? null : () => widget.onConfirm(_local),
                    child: const Text('Onayla'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
