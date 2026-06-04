import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/firebase_config.dart';
import 'api_client.dart';
import 'auth_store.dart';

class AuthService {
  AuthService({ApiClient? api, AuthStore? store})
      : _api = api ?? ApiClient(null),
        _store = store ?? AuthStore();

  final ApiClient _api;
  final AuthStore _store;

  Future<String?> loadStoredToken() => _store.getToken();

  Future<void> signOut() async {
    await _store.setToken(null);
    if (FirebaseConfig.isConfigured) {
      await GoogleSignIn().signOut();
      await FirebaseAuth.instance.signOut();
    }
  }

  Future<String> signInWithGoogle() async {
    if (!FirebaseConfig.isConfigured) {
      throw StateError('Firebase yapılandırılmamış (dart-define FIREBASE_*)');
    }
    final google = GoogleSignIn(scopes: ['email']);
    final account = await google.signIn();
    if (account == null) throw StateError('Google giriş iptal');
    final auth = await account.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: auth.accessToken,
      idToken: auth.idToken,
    );
    final cred = await FirebaseAuth.instance.signInWithCredential(credential);
    final idToken = await cred.user?.getIdToken();
    if (idToken == null || idToken.isEmpty) {
      throw StateError('Firebase id_token alınamadı');
    }
    return _exchangeFirebaseToken(idToken);
  }

  Future<String> signInWithDevToken(String jwt) async {
    final t = jwt.trim();
    if (t.isEmpty) throw StateError('JWT boş');
    await _store.setToken(t);
    return t;
  }

  Future<String> _exchangeFirebaseToken(String idToken) async {
    final j = await _api.postJson('/auth/firebase-token', {
      'id_token': idToken,
      'remember_me': true,
    });
    final token = j['token'] as String?;
    if (token == null || token.isEmpty) {
      throw StateError('Backend JWT dönmedi');
    }
    await _store.setToken(token);
    return token;
  }
}
