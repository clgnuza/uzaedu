import { SetMetadata } from '@nestjs/common';
import type { ModeratorModuleKey } from '../../types/enums';

export const REQUIRE_MODULE_KEY = 'require_module';

/**
 * Moderator rolü için gerekli modül.
 * Sadece role=moderator ise kontrol edilir; superadmin için her zaman geçer.
 */
export const RequireModule = (module: ModeratorModuleKey) =>
  SetMetadata(REQUIRE_MODULE_KEY, module);
