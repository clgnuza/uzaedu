import 'api_client.dart';

/// Teknik / İngilizce hataları kullanıcıya Türkçe ve sade metne çevirir.
String userFacingError(Object? error, {String? fallback}) {
  if (error == null) {
    return fallback ?? 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  }

  final status = error is ApiException ? error.status : null;
  final raw = _extractMessage(error).toLowerCase();

  if (status != null) {
    final byStatus = _httpStatusMessage(status);
    if (byStatus != null) return byStatus;
  }

  if (_looksLikeNetwork(raw)) {
    return 'İnternet bağlantınızı kontrol edip tekrar deneyin.';
  }

  if (raw.contains('purchase token') || raw.contains('purchase_token')) {
    return 'Ödeme bilgisi alınamadı. Satın almayı tekrar deneyin.';
  }
  if (raw.contains('makbuz') || raw.contains('receipt')) {
    return 'App Store makbuzu alınamadı. Satın almayı tekrar deneyin.';
  }
  if (raw.contains('google_play_service_account') || raw.contains('google api 403')) {
    return 'Mağaza doğrulaması sunucuda henüz ayarlanmamış. Destek ile iletişime geçin.';
  }
  if (raw.contains('package_name') || raw.contains('google_play_package')) {
    return 'Uygulama paket adı sunucuda eşleşmiyor. Destek ile iletişime geçin.';
  }
  if (raw.contains('apple_shared_secret') || raw.contains('skipped_no_credentials')) {
    return 'App Store doğrulaması sunucuda henüz ayarlanmamış. Destek ile iletişime geçin.';
  }
  if (raw.contains('apple status')) {
    return _appleStatusMessage(raw) ?? 'App Store ödemesi doğrulanamadı. Biraz sonra tekrar deneyin.';
  }
  if (raw.contains('iap listesinde yok') || raw.contains('ürün iap')) {
    return 'Bu paket henüz tanımlı değil. Yönetici product_id eşlemesini kontrol etsin.';
  }
  if (raw.contains('duplicate') || raw.contains('daha önce işlendi') || raw.contains('zaten işlenmiş')) {
    return 'Bu satın alma daha önce hesabınıza işlendi.';
  }
  if (raw.contains('user_cancelled') || raw.contains('canceled') || raw.contains('cancelled')) {
    return 'Satın alma iptal edildi.';
  }
  if (raw.contains('item_already_owned')) {
    return 'Bu ürün zaten satın alınmış görünüyor. Uygulamayı yeniden açıp tekrar deneyin.';
  }
  if (raw.contains('item_unavailable') || raw.contains('productnotfound')) {
    return 'Bu paket mağazada şu an satışta değil.';
  }
  if (raw.contains('billing_unavailable') || raw.contains('storekit') && raw.contains('not available')) {
    return 'Mağaza bu cihazda kullanılamıyor.';
  }
  if (raw.contains('insufficient') && raw.contains('market')) {
    return 'Bakiyeniz yetersiz.';
  }
  if (raw.contains('forbidden') || raw.contains('yetkiniz yok')) {
    return 'Bu işlem için yetkiniz yok.';
  }

  // Zaten Türkçe ve kısa ise olduğu gibi göster
  final original = _extractMessage(error);
  if (_looksTurkishUserMessage(original)) {
    return original;
  }

  return fallback ?? 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}

String _extractMessage(Object error) {
  if (error is ApiException) return error.message;
  final s = error.toString();
  final idx = s.indexOf(': ');
  if (idx > 0 && idx < 40) {
    return s.substring(idx + 2).trim();
  }
  return s.trim();
}

bool _looksLikeNetwork(String raw) {
  return raw.contains('socket') ||
      raw.contains('failed host lookup') ||
      raw.contains('connection refused') ||
      raw.contains('connection timed out') ||
      raw.contains('network is unreachable') ||
      raw.contains('clientexception') ||
      raw.contains('handshake') ||
      raw.contains('errno');
}

bool _looksTurkishUserMessage(String text) {
  if (text.length > 180) return false;
  if (text.contains('Exception') || text.contains('Error:') || text.startsWith('HTTP ')) {
    return false;
  }
  const trHints = ['lütfen', 'tekrar', 'mağaza', 'satın', 'bakiye', 'oturum', 'bağlantı', 'iptal', 'doğrula'];
  final lower = text.toLowerCase();
  return trHints.any(lower.contains);
}

String? _httpStatusMessage(int status) {
  if (status >= 500 && status < 600) {
    return 'Sunucuda geçici bir sorun var. Lütfen daha sonra tekrar deneyin.';
  }
  switch (status) {
    case 401:
      return 'Oturumunuz sona ermiş. Çıkış yapıp yeniden giriş yapın.';
    case 403:
      return 'Bu işlem için yetkiniz yok.';
    case 404:
      return 'İstenen kayıt bulunamadı.';
    case 408:
    case 504:
      return 'Sunucu yanıt vermedi. Biraz sonra tekrar deneyin.';
    case 429:
      return 'Çok fazla deneme yaptınız. Lütfen kısa süre sonra tekrar deneyin.';
    default:
      if (status >= 400) {
        return 'İşlem tamamlanamadı (kod $status).';
      }
      return null;
  }
}

String? _appleStatusMessage(String raw) {
  final m = RegExp(r'apple status (\d+)').firstMatch(raw);
  if (m == null) return null;
  switch (m.group(1)) {
    case '21000':
      return 'App Store isteği geçersiz. Tekrar deneyin.';
    case '21002':
      return 'App Store makbuzu okunamadı. Tekrar deneyin.';
    case '21003':
      return 'App Store kimlik doğrulaması başarısız.';
    case '21004':
      return 'App Store paylaşılan anahtarı hatalı (sunucu ayarı).';
    case '21005':
      return 'App Store geçici olarak yanıt vermiyor. Sonra tekrar deneyin.';
    case '21007':
    case '21008':
      return 'Test ortamı makbuzu; canlıda tekrar deneyin veya sandbox hesabı kullanın.';
    default:
      return null;
  }
}

/// Sunucu doğrulama notu → kullanıcı mesajı
String userFacingVerificationNote(String? note, {required String status}) {
  if (note == null || note.trim().isEmpty) {
    return _purchaseStatusMessage(status);
  }
  return userFacingError(note, fallback: _purchaseStatusMessage(status));
}

String _purchaseStatusMessage(String status) {
  switch (status) {
    case 'verified':
      return 'Ödeme onaylandı.';
    case 'duplicate':
      return 'Bu satın alma daha önce işlendi.';
    case 'rejected':
      return 'Ödeme doğrulanamadı.';
    case 'pending':
      return 'Ödeme işleniyor.';
    case 'skipped_no_credentials':
      return 'Sunucuda mağaza doğrulaması henüz açılmamış.';
    default:
      return 'Ödeme durumu: $status';
  }
}
