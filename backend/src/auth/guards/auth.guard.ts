import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('firebase') {
  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err) throw err;
    if (!user) {
      throw new HttpException(
        { code: 'UNAUTHORIZED', message: 'Oturum açmanız gerekiyor.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }
}

/** JWT varsa kullanıcıyı `request.user` yapar; yoksa veya geçersizse 401 atmadan devam eder (public listelerde is_own için). */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('firebase') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      /* oturum yok veya token geçersiz — public erişim */
    }
    return true;
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | undefined {
    if (err) return undefined;
    return user ?? undefined;
  }
}
