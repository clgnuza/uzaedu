import type { ApiError } from './api';

export type WebAuthnErrorContext = 'login' | 'register';

const API_MESSAGES: Record<string, string> = {
  INVALID_ORIGIN: 'Geçersiz site adresi. Uygulamayı ana ekrandan açın veya doğru adresten girin.',
  CHALLENGE_EXPIRED: 'Doğrulama süresi doldu. Lütfen tekrar deneyin.',
  VERIFY_FAILED: 'Biyometrik doğrulama başarısız. Tekrar deneyin.',
  PASSKEY_DISABLED: 'Biyometrik giriş hesabınızda kapalı. Profil → Güvenlik bölümünden açın.',
  NO_PASSKEY:
    'Bu hesapta biyometrik giriş tanımlı değil. Önce şifre ile giriş yapıp cihazınızı ekleyin.',
  NOT_FOUND: 'Kayıt bulunamadı.',
  INVALID_INPUT: 'Geçersiz bilgi gönderildi.',
  UNAUTHORIZED: 'Giriş yapılamadı. E-posta adresinizi ve biyometrik kaydınızı kontrol edin.',
  WRONG_PORTAL_USE_TEACHER_LOGIN: 'Bu hesap öğretmen girişi ile kullanılır.',
  WRONG_PORTAL_USE_SCHOOL_LOGIN: 'Bu hesap okul girişi ile kullanılır.',
};

function looksTurkish(msg: string): boolean {
  return /[çğıöşüÇĞİÖŞÜ]/.test(msg) || /\b(lütfen|giriş|hesap|başarısız|tekrar|kapalı)\b/i.test(msg);
}

function domExceptionMessage(name: string, context: WebAuthnErrorContext): string | null {
  switch (name) {
    case 'NotAllowedError':
      return context === 'register'
        ? 'Biyometrik kayıt iptal edildi veya süre doldu. Parmak izi / yüz tanımayı tamamlayıp tekrar deneyin.'
        : 'Biyometrik giriş iptal edildi veya süre doldu. Tekrar deneyin.';
    case 'InvalidStateError':
      return context === 'register'
        ? 'Bu cihazda biyometrik giriş zaten kayıtlı olabilir.'
        : 'Kayıtlı biyometrik giriş bulunamadı. Şifre ile giriş yapıp cihazınızı yeniden ekleyin.';
    case 'AbortError':
      return 'İşlem iptal edildi.';
    case 'SecurityError':
      return 'Güvenli bağlantı (HTTPS) gerekir. Uygulamayı ana ekrandan açmayı deneyin.';
    case 'NotSupportedError':
      return 'Bu cihaz veya tarayıcı biyometrik girişi desteklemiyor.';
    case 'UnknownError':
      return context === 'register'
        ? 'Biyometrik kayıt tamamlanamadı. Cihazınızda parmak izi veya yüz tanıma tanımlı olduğundan emin olun.'
        : 'Biyometrik giriş tamamlanamadı. Tekrar deneyin.';
    default:
      return null;
  }
}

function englishMessageHint(msg: string, context: WebAuthnErrorContext): string | null {
  const lower = msg.toLowerCase();
  if (lower.includes('cancel')) return 'Biyometrik doğrulama iptal edildi.';
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'Biyometrik doğrulama süresi doldu. Tekrar deneyin.';
  }
  if (lower.includes('not allowed')) {
    return context === 'register'
      ? 'Biyometrik kayıt izni verilmedi. İşlemi onaylayıp tekrar deneyin.'
      : 'Biyometrik giriş izni verilmedi. İşlemi onaylayıp tekrar deneyin.';
  }
  if (
    lower.includes('no available authenticator') ||
    lower.includes('authenticator was not found') ||
    lower.includes('no credentials')
  ) {
    return 'Cihazınızda parmak izi veya yüz tanıma tanımlı değil. Telefon ayarlarından ekleyin.';
  }
  if (lower.includes('not supported')) return 'Bu cihaz biyometrik girişi desteklemiyor.';
  if (lower.includes('user gesture') || lower.includes('gesture')) {
    return 'Butona tekrar dokunarak biyometrik doğrulamayı başlatın.';
  }
  if (lower.includes('already registered') || lower.includes('excluded credential')) {
    return 'Bu cihaz zaten kayıtlı.';
  }
  if (lower.includes('abort')) return 'İşlem iptal edildi.';
  if (lower.includes('rp id') || lower.includes('domain') || lower.includes('origin')) {
    return 'Site adresi uyumsuz. Uygulamayı ana ekrandan açın.';
  }
  if (lower.includes('user verification')) {
    return 'Parmak izi veya yüz tanıma doğrulaması tamamlanmadı.';
  }
  return null;
}

function fallback(context: WebAuthnErrorContext): string {
  return context === 'register'
    ? 'Biyometrik kayıt başarısız. Tekrar deneyin.'
    : 'Biyometrik giriş başarısız. Tekrar deneyin.';
}

export function getWebAuthnErrorMessage(e: unknown, context: WebAuthnErrorContext): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = String((e as ApiError).code ?? '');
    if (code && API_MESSAGES[code]) return API_MESSAGES[code];
  }

  if (e instanceof DOMException) {
    const mapped = domExceptionMessage(e.name, context);
    if (mapped) return mapped;
    const hint = englishMessageHint(e.message, context);
    if (hint) return hint;
  }

  if (e instanceof Error) {
    const api = e as ApiError;
    if (api.code && API_MESSAGES[api.code]) return API_MESSAGES[api.code];

    const msg = e.message?.trim();
    if (msg) {
      if (looksTurkish(msg)) return msg;
      const hint = englishMessageHint(msg, context);
      if (hint) return hint;
      if (/^[a-zA-Z0-9\s.,:;'"()-]+$/.test(msg) && msg.length > 8) return fallback(context);
      return msg;
    }
  }

  if (typeof e === 'string' && e.trim()) {
    if (looksTurkish(e)) return e.trim();
    const hint = englishMessageHint(e, context);
    if (hint) return hint;
  }

  return fallback(context);
}
