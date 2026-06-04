import '../models/optik_models.dart';

/// Toplu sınıf taraması — sıradaki eksik öğrenci
class BatchScanState {
  BatchScanState({
    required this.students,
    required this.scannedIds,
  });

  final List<ClassStudent> students;
  final Set<String> scannedIds;

  int get total => students.length;
  int get doneCount => students.where((s) => scannedIds.contains(s.id)).length;
  double get progress => total == 0 ? 0 : doneCount / total;

  ClassStudent? get current {
    for (final s in students) {
      if (!scannedIds.contains(s.id)) return s;
    }
    return null;
  }

  ClassStudent? nextAfter(String studentId) {
    var found = false;
    for (final s in students) {
      if (found && !scannedIds.contains(s.id)) return s;
      if (s.id == studentId) found = true;
    }
    return current;
  }

  void markScanned(String studentId) => scannedIds.add(studentId);

  bool get isComplete => current == null;
}
