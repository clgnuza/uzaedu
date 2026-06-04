import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this.token);

  final String? token;
  final String _base = AppConfig.apiBaseUrl;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> getBody(String path) async {
    final res = await http.get(Uri.parse('$_base$path'), headers: _headers);
    return _decodeBody(res);
  }

  Future<Map<String, dynamic>> getJson(String path) async {
    final body = await getBody(path);
    if (body is Map<String, dynamic>) return body;
    if (body is Map) return Map<String, dynamic>.from(body);
    return {};
  }

  Future<Map<String, dynamic>> patchJson(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decodeMap(res);
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  dynamic _decodeBody(http.Response res) {
    final dynamic parsed = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final msg = parsed is Map && parsed['message'] != null
          ? parsed['message'].toString()
          : 'HTTP ${res.statusCode}';
      throw ApiException(msg, status: res.statusCode);
    }
    return parsed;
  }

  Map<String, dynamic> _decodeMap(http.Response res) {
    final parsed = _decodeBody(res);
    if (parsed is Map<String, dynamic>) return parsed;
    if (parsed is Map) return Map<String, dynamic>.from(parsed);
    return {};
  }

  Map<String, dynamic> _decode(http.Response res) => _decodeMap(res);
}
