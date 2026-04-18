import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import * as admin from 'firebase-admin';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { AUTH_COOKIE_NAME } from '../auth-cookie';
import { UserRole } from '../../types/enums';

function isSchoolReviewsSiteBanExemptPath(path: string): boolean {
  if (path === '/api/health' || path.startsWith('/api/health/')) return true;
  if (path.startsWith('/api/auth/')) return true;
  if (path === '/api/me' || path.startsWith('/api/me/')) return true;
  return false;
}

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

    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];

    for (const raw of candidates) {
      if (looksLikeUserIdUuid(raw)) {
        const user = await this.authService.validateUserId(raw);
        if (user) return this.assertSchoolReviewsSiteBan(user, path);
      }
    }

    const app = getFirebaseApp();
    for (const raw of candidates) {
      if (!app || !looksLikeFirebaseIdToken(raw)) continue;
      try {
        const decoded = await app.auth().verifyIdToken(raw);
        const uid = decoded.uid;
        const user = await this.authService.validateFirebaseUid(uid);
        if (user) return this.assertSchoolReviewsSiteBan(user, path);
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

  private assertSchoolReviewsSiteBan(user: User, path: string) {
    if (user.role === UserRole.superadmin) return user;
    const until = user.schoolReviewsSiteBanUntil;
    if (until instanceof Date && until.getTime() > Date.now() && !isSchoolReviewsSiteBanExemptPath(path)) {
      const untilStr = until.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
      throw new ForbiddenException({
        code: 'SCHOOL_REVIEWS_SITE_BAN',
        message: `Okul değerlendirme kuralları gereği hesabınız ${untilStr} tarihine kadar kısıtlandı (içerik bildirimleri / ceza politikası). Profil (/me) ve oturum uçları kullanılabilir; ayrıntı için Bildirimler → Ceza.`,
      });
    }
    return user;
  }
}
