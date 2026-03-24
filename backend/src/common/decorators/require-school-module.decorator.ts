import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SCHOOL_MODULE_KEY = 'require_school_module';
export const REQUIRE_ANY_SCHOOL_MODULES_KEY = 'require_any_school_modules';

/**
 * Teacher / school_admin için: Okulun enabled_modules içinde bu modül açık olmalı.
 * superadmin / moderator atlanır (okul scope'u yok).
 */
export const RequireSchoolModule = (moduleKey: string) =>
  SetMetadata(REQUIRE_SCHOOL_MODULE_KEY, moduleKey);

/** enabled_modules içinden en az biri yeterli (örn. document veya bilsem). */
export const RequireAnySchoolModule = (...moduleKeys: string[]) =>
  SetMetadata(REQUIRE_ANY_SCHOOL_MODULES_KEY, moduleKeys);
