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
