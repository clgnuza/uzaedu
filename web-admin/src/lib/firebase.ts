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

/** Google ile giriş; idToken döner veya hata fırlatır */
export async function signInWithGoogle(): Promise<string> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase yapılandırılmadı.');
  const provider = new GoogleAuthProvider();
  const result: UserCredential = await signInWithPopup(a, provider);
  const token = await result.user.getIdToken();
  return token;
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
): Promise<{ confirm: (code: string) => Promise<string> }> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase yapılandırılmadı.');
  const verifier = new RecaptchaVerifier(a, containerId, {
    size: 'invisible',
    callback: () => {},
  });
  const confirmation = await signInWithPhoneNumber(a, phoneNumber, verifier);
  return {
    confirm: async (code: string) => {
      const result = await confirmation.confirm(code);
      return result.user.getIdToken();
    },
  };
}
