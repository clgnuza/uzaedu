import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import * as admin from 'firebase-admin';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { AUTH_COOKIE_NAME } from '../auth-cookie';

function getFirebaseApp(): admin.app.App | null {
  try {
    return admin.app();
  } catch {
    return null;
  }
}

/** Postgres / TypeORM user.id (UUID v4) */
function looksLikeUserIdUuid(token: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token.trim());
}

/** Firebase ID token (JWT) üç bölümlüdür. */
function looksLikeFirebaseIdToken(token: string): boolean {
  return token.split('.').length === 3;
}

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: Request): Promise<User> {
    const authHeader = req.headers.authorization;
    const bearer =
      authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const fromCookie =
      typeof req.cookies === 'object' && req.cookies !== null
        ? String((req.cookies as Record<string, string>)[AUTH_COOKIE_NAME] ?? '').trim()
        : '';
    /** Çerez önce: Bearer’da eski Firebase JWT kalırsa bile parola oturumu (UUID) çalışsın. */
    const candidates = [...new Set([fromCookie, bearer].filter((x) => x.length > 0))];
    if (candidates.length === 0) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Oturum açmanız gerekiyor.',
      });
    }

    for (const raw of candidates) {
      if (looksLikeUserIdUuid(raw)) {
        const user = await this.authService.validateUserId(raw);
        if (user) return user;
      }
    }

    const app = getFirebaseApp();
    for (const raw of candidates) {
      if (!app || !looksLikeFirebaseIdToken(raw)) continue;
      try {
        const decoded = await app.auth().verifyIdToken(raw);
        const uid = decoded.uid;
        const user = await this.authService.validateFirebaseUid(uid);
        if (user) return user;
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Oturum açmanız gerekiyor.',
        });
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
      }
    }

    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Oturum açmanız gerekiyor.',
    });
  }
}
