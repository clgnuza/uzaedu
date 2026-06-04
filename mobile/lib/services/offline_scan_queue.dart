import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Çevrimdışı optik tarama gönderimi (PWA offline queue benzeri) */
class OfflineScanQueue {
  static const _fileName = 'optik_offline_scans.json';

  Future<File> _file() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_fileName');
  }

  Future<List<PendingScanRequest>> list() async {
    final f = await _file();
    if (!await f.exists()) return [];
    try {
      final raw = jsonDecode(await f.readAsString());
      if (raw is! List) return [];
      return raw
          .map((e) => PendingScanRequest.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> enqueue(PendingScanRequest item) async {
    final rows = await list();
    rows.add(item);
    await _write(rows);
  }

  Future<void> remove(String id) async {
    final rows = await list();
    rows.removeWhere((r) => r.id == id);
    await _write(rows);
  }

  Future<void> _write(List<PendingScanRequest> rows) async {
    final f = await _file();
    await f.writeAsString(jsonEncode(rows.map((e) => e.toJson()).toList()));
  }
}

class PendingScanRequest {
  PendingScanRequest({
    required this.id,
    required this.path,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String path;
  final Map<String, dynamic> body;
  final int createdAt;

  factory PendingScanRequest.create({
    required String path,
    required Map<String, dynamic> body,
  }) {
    return PendingScanRequest(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      path: path,
      body: body,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
  }

  factory PendingScanRequest.fromJson(Map<String, dynamic> j) => PendingScanRequest(
        id: j['id'] as String,
        path: j['path'] as String,
        body: Map<String, dynamic>.from(j['body'] as Map),
        createdAt: (j['createdAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'path': path,
        'body': body,
        'createdAt': createdAt,
      };
}
