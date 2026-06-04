import 'package:shared_preferences/shared_preferences.dart';

class AuthStore {
  static const _keyToken = 'jwt_token';

  Future<String?> getToken() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_keyToken);
  }

  Future<void> setToken(String? token) async {
    final p = await SharedPreferences.getInstance();
    if (token == null || token.isEmpty) {
      await p.remove(_keyToken);
    } else {
      await p.setString(_keyToken, token);
    }
  }
}
