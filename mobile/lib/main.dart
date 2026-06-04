import 'package:app_links/app_links.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'config/firebase_config.dart';
import 'features/auth/login_page.dart';
import 'features/home/home_page.dart';
import 'features/scan/optik_scan_page.dart';
import 'models/optik_models.dart';
import 'services/auth_service.dart';
import 'services/deep_link_service.dart';
import 'services/sync_service.dart';
import 'services/api_client.dart';

Future<void> _initFirebase() async {
  if (!FirebaseConfig.isConfigured) return;
  await Firebase.initializeApp(
    options: FirebaseOptions(
      apiKey: FirebaseConfig.apiKey,
      appId: FirebaseConfig.appId,
      messagingSenderId: FirebaseConfig.messagingSenderId,
      projectId: FirebaseConfig.projectId,
      authDomain: FirebaseConfig.authDomain,
      storageBucket: FirebaseConfig.storageBucket,
    ),
  );
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const OptikApp());
}

class OptikApp extends StatefulWidget {
  const OptikApp({super.key});

  @override
  State<OptikApp> createState() => _OptikAppState();
}

class _OptikAppState extends State<OptikApp> {
  String? _token;
  OptikScanIntent? _pendingIntent;
  bool _booting = true;
  final _appLinks = AppLinks();
  final _auth = AuthService();

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await _initFirebase();
    final stored = await _auth.loadStoredToken();
    if (stored != null && stored.isNotEmpty) {
      final sync = SyncService(ApiClient(stored));
      await sync.flushQueue();
      if (mounted) setState(() => _token = stored);
    }
    await _listenLinks();
    if (mounted) setState(() => _booting = false);
  }

  Future<void> _listenLinks() async {
    final initial = await _appLinks.getInitialLink();
    _applyUri(initial);
    _appLinks.uriLinkStream.listen(_applyUri);
  }

  void _applyUri(Uri? uri) {
    final intent = parseOptikScanUri(uri);
    if (intent == null) return;
    setState(() => _pendingIntent = intent);
    if (_token != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openScan(intent));
    }
  }

  void _openScan(OptikScanIntent intent) {
    if (!mounted || _token == null) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => OptikScanPage(token: _token!, intent: intent),
      ),
    );
  }

  void _onAuthed(String token) {
    setState(() => _token = token);
    SyncService(ApiClient(token)).flushQueue();
    final pending = _pendingIntent;
    if (pending != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openScan(pending));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_booting) {
      return const MaterialApp(
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }
    return MaterialApp(
      title: 'Uzaedu Optik',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFC026D3)),
        useMaterial3: true,
      ),
      home: _token == null
          ? LoginPage(onReady: _onAuthed)
          : HomePage(token: _token!, pendingIntent: _pendingIntent),
    );
  }
}
