import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

export interface CurrentUserPayload {
  user: User;
  userId: string;
  role: string;
  schoolId: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext): CurrentUserPayload | string | null => {
    const request = ctx.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user as User | undefined;
    if (!user) return null;
    const payload: CurrentUserPayload = {
      user,
      userId: user.id,
      role: user.role,
      schoolId: user.school_id,
    };
    return (data ? payload[data] : payload) as CurrentUserPayload | string | null;
  },
);
