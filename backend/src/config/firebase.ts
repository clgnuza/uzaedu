import * as admin from 'firebase-admin';
import { env } from './env';

let initialized = false;

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
    });
    initialized = true;
  } catch {
    // Log but do not throw; backend can run in local without Firebase (dev Bearer userId)
  }
}
