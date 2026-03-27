/**
 * Firebase Client SDK – Google/Apple/Telefon girişi için.
 * NEXT_PUBLIC_FIREBASE_* env değişkenleri tanımlıysa kullanılır.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type Auth,
  type UserCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Firebase uygulaması yapılandırılmış mı */
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
}

/** Telefon (SMS) girişi için Web uygulaması kimliği önerilir (Firebase Console → Project settings → Your apps) */
export function isFirebasePhoneAuthConfigured(): boolean {
  return isFirebaseConfigured() && !!(firebaseConfig.appId && firebaseConfig.messagingSenderId);
}

let phoneRecaptchaVerifier: RecaptchaVerifier | null = null;

/** Türkiye cep için E.164 (+905551234567). Boşluk/tire kabul eder. */
export function normalizePhoneE164Turkey(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 && digits.startsWith('5')) return `+90${digits}`;
  if (digits.length === 11 && digits.startsWith('05')) return `+90${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('90') && digits[2] === '5') return `+${digits}`;
  return null;
}

export function formatFirebaseAuthError(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: string }).code) : '';
  const map: Record<string, string> = {
    'auth/invalid-phone-number': 'Geçersiz telefon numarası (örn. 5XX XXX XX XX).',
    'auth/missing-phone-number': 'Telefon numarası eksik.',
    'auth/too-many-requests': 'Çok fazla deneme. Bir süre sonra tekrar deneyin.',
    'auth/captcha-check-failed': 'reCAPTCHA doğrulanamadı. Sayfayı yenileyip tekrar deneyin.',
    'auth/quota-exceeded': 'SMS kotası veya Firebase faturalandırması gerekli.',
    'auth/invalid-app-credential': 'Firebase web uygulaması / API anahtarı ayarlarını kontrol edin.',
    'auth/operation-not-allowed': 'Firebase Console’da Telefon girişi kapalı olabilir.',
    'auth/invalid-verification-code': 'SMS kodu hatalı veya süresi dolmuş.',
    'auth/session-expired': 'Doğrulama süresi doldu. Kodu yeniden isteyin.',
  };
  if (code && map[code]) return map[code];
  if (err instanceof Error && err.message) return err.message;
  return 'İşlem başarısız.';
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;
  if (auth) return auth;
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else {
    auth = getAuth(getApps()[0] as FirebaseApp);
  }
  return auth;
}

/** Google popup ile giriş; idToken döner */
export async function signInWithGoogle(): Promise<string> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase yapılandırılmadı.');
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const result: UserCredential = await signInWithPopup(a, provider);
  return result.user.getIdToken();
}

/** Apple ile giriş; idToken döner veya hata fırlatır */
export async function signInWithApple(): Promise<string> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase yapılandırılmadı.');
  const provider = new OAuthProvider('apple.com');
  const result: UserCredential = await signInWithPopup(a, provider);
  const token = await result.user.getIdToken();
  return token;
}

/** Telefon doğrulaması başlatır; dönen confirm(code) ile SMS kodunu onaylayıp idToken alınır */
export async function startPhoneVerification(
  containerId: string,
  phoneNumber: string,
  options?: { recaptchaSize?: 'normal' | 'invisible' },
): Promise<{ confirm: (code: string) => Promise<string> }> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase yapılandırılmadı.');
  if (phoneRecaptchaVerifier) {
    try {
      phoneRecaptchaVerifier.clear();
    } catch {
      /* ignore */
    }
    phoneRecaptchaVerifier = null;
  }
  /** Görünür v2: localhost / Enterprise düşüşünde invisible’a göre daha güvenilir */
  const recaptchaSize = options?.recaptchaSize ?? 'normal';
  phoneRecaptchaVerifier = new RecaptchaVerifier(a, containerId, {
    size: recaptchaSize,
    callback: () => {},
    'expired-callback': () => {
      try {
        phoneRecaptchaVerifier?.clear();
      } catch {
        /* ignore */
      }
      phoneRecaptchaVerifier = null;
    },
  });
  const confirmation = await signInWithPhoneNumber(a, phoneNumber, phoneRecaptchaVerifier);
  try {
    phoneRecaptchaVerifier.clear();
  } catch {
    /* ignore */
  }
  phoneRecaptchaVerifier = null;

  return {
    confirm: async (code: string) => {
      const result = await confirmation.confirm(code);
      return result.user.getIdToken();
    },
  };
}
