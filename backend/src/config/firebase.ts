import * as admin from 'firebase-admin';
import { env } from './env';

let initialized = false;

export function isFirebaseAdminReady(): boolean {
  return initialized;
}

export function initFirebase(): void {
  if (initialized) return;
  const { projectId, clientEmail, privateKey } = env.firebase;
  if (!projectId || !clientEmail || !privateKey) return;
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
    initialized = true;
  } catch (e) {
    console.error('[Firebase] initializeApp başarısız:', e);
  }
}
