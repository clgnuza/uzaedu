import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import * as admin from 'firebase-admin';
import { AuthService } from '../auth.service';
import { env } from '../../config/env';
import { User } from '../../users/entities/user.entity';
import { AUTH_COOKIE_NAME } from '../auth-cookie';

function getFirebaseApp(): admin.app.App | null {
  try {
    return admin.app();
  } catch {
    return null;
  }
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
    const token = bearer || fromCookie;
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Oturum açmanız gerekiyor.',
      });
    }

    const app = getFirebaseApp();
    if (app) {
      try {
        const decoded = await app.auth().verifyIdToken(token);
        const uid = decoded.uid;
        const user = await this.authService.validateFirebaseUid(uid);
        if (!user) {
          throw new UnauthorizedException({
            code: 'UNAUTHORIZED',
            message: 'Oturum açmanız gerekiyor.',
          });
        }
        return user;
      } catch {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Oturum açmanız gerekiyor.',
        });
      }
    }

    if (!app && env.nodeEnv === 'local') {
      const user = await this.authService.validateUserId(token);
      if (user) return user;
    }

    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Oturum açmanız gerekiyor.',
    });
  }
}
