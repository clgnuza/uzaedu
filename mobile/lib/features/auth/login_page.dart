import 'package:flutter/material.dart';

import '../../config/firebase_config.dart';
import '../../services/auth_service.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.onReady});

  final ValueChanged<String> onReady;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _jwtCtrl = TextEditingController();
  final _auth = AuthService();
  String? _error;
  bool _busy = false;

  Future<void> _google() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await _auth.signInWithGoogle();
      if (mounted) widget.onReady(token);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _devJwt() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await _auth.signInWithDevToken(_jwtCtrl.text);
      if (mounted) widget.onReady(token);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fb = FirebaseConfig.isConfigured;
    return Scaffold(
      appBar: AppBar(title: const Text('Uzaedu Optik')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (fb) ...[
              FilledButton.icon(
                onPressed: _busy ? null : _google,
                icon: const Icon(Icons.login),
                label: const Text('Google ile giriş'),
              ),
              const SizedBox(height: 20),
              const Divider(),
              const SizedBox(height: 8),
            ],
            Text(
              fb ? 'Geliştirici JWT' : 'JWT (Firebase yapılandırılmadı)',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _jwtCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'PWA oturum token',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _devJwt,
              child: const Text('Devam'),
            ),
          ],
        ),
      ),
    );
  }
}
