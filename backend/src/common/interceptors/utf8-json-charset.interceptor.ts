import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Response } from 'express';

@Injectable()
export class Utf8JsonCharsetInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap({
        finalize: () => {
          const type = res.getHeader('Content-Type');
          if (
            typeof type === 'string' &&
            type.startsWith('application/json') &&
            !/charset=/i.test(type)
          ) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
        },
      }),
    );
  }
}
