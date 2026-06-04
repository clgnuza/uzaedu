import 'dart:convert';
import 'dart:io';

import 'package:camera/camera.dart';

Future<String> xFileToDataUrl(XFile file) async {
  final bytes = await file.readAsBytes();
  final b64 = base64Encode(bytes);
  return 'data:image/jpeg;base64,$b64';
}

Future<String> filePathToDataUrl(String path) async {
  final bytes = await File(path).readAsBytes();
  final b64 = base64Encode(bytes);
  return 'data:image/jpeg;base64,$b64';
}
