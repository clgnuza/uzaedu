import 'package:flutter/material.dart';

import '../../models/optik_models.dart';
import '../../services/api_client.dart';
import '../../services/optik_repository.dart';
import '../../services/sync_service.dart';
import '../scan/optik_scan_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.token, this.pendingIntent});

  final String token;
  final OptikScanIntent? pendingIntent;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final OptikRepository _repo = OptikRepository(ApiClient(widget.token));
  late final SyncService _sync = SyncService(ApiClient(widget.token));
  List<ExamSessionSummary> _sessions = [];
  int _pendingQueue = 0;
  bool _loading = true;
  String? _err;

  @override
  void initState() {
    super.initState();
    if (widget.pendingIntent != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openIntent(widget.pendingIntent!));
    }
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      await _sync.flushQueue();
      final list = await _repo.listSessions();
      final pending = await _sync.pendingCount();
      if (!mounted) return;
      setState(() {
        _sessions = list;
        _pendingQueue = pending;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _err = e.toString();
        _loading = false;
      });
    }
  }

  void _openIntent(OptikScanIntent intent) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => OptikScanPage(token: widget.token, intent: intent),
      ),
    ).then((_) => _load());
  }

  void _openSession(ExamSessionSummary s, {bool batch = false}) {
    _openIntent(OptikScanIntent(
      templateId: s.templateId,
      templateName: s.templateName,
      sessionId: s.id,
      mode: 'mc_student',
      classId: s.classId,
      className: s.className,
      batchMode: batch,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Optik tarama'),
        actions: [
          if (_pendingQueue > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Chip(
                  label: Text('Kuyruk $_pendingQueue'),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ),
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _err != null
              ? Center(child: Text(_err!, textAlign: TextAlign.center))
              : _sessions.isEmpty
                  ? const Center(child: Text('Oturum yok — PWA’dan sınav oluşturun'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: _sessions.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final s = _sessions[i];
                        return Card(
                          child: Column(
                            children: [
                              ListTile(
                                title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                                subtitle: Text(s.templateName),
                                trailing: const Icon(Icons.camera_alt),
                                onTap: () => _openSession(s),
                              ),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                                child: SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton.icon(
                                    onPressed: () => _openSession(s, batch: true),
                                    icon: const Icon(Icons.groups, size: 18),
                                    label: const Text('Toplu sınıf tara'),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}
