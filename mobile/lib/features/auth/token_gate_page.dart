import 'package:flutter/material.dart';

import '../../services/auth_store.dart';

class TokenGatePage extends StatefulWidget {
  const TokenGatePage({super.key, required this.onReady});

  final ValueChanged<String> onReady;

  @override
  State<TokenGatePage> createState() => _TokenGatePageState();
}

class _TokenGatePageState extends State<TokenGatePage> {
  final _ctrl = TextEditingController();
  final _store = AuthStore();
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final t = await _store.getToken();
    if (t != null && t.isNotEmpty && mounted) widget.onReady(t);
  }

  Future<void> _save() async {
    final t = _ctrl.text.trim();
    if (t.isEmpty) {
      setState(() => _error = 'JWT gerekli (PWA oturumundan)');
      return;
    }
    await _store.setToken(t);
    if (mounted) widget.onReady(t);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Uzaedu Optik')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Web panelde giriş yaptıktan sonra JWT’yi yapıştırın. '
              '(Firebase oturumu — geliştirme)',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _ctrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Bearer token',
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 16),
            FilledButton(onPressed: _save, child: const Text('Devam')),
          ],
        ),
      ),
    );
  }
}
