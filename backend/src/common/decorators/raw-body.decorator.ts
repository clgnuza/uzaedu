import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Body'yi ValidationPipe olmadan alır (duty/preferences gibi manuel parse gereken route'lar için) */
export const RawBody = createParamDecorator((_data: unknown, ctx: ExecutionContext): Record<string, unknown> => {
  const req = ctx.switchToHttp().getRequest();
  const body = req.body;
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
});
