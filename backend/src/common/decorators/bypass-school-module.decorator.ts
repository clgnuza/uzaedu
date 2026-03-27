import { SetMetadata } from '@nestjs/common';

export const BYPASS_SCHOOL_MODULE_GUARD_KEY = 'bypass_school_module_guard';

/** Public okul değerlendirmesi etkileşimlerinde school module kapalı olsa da auth endpoint erişimine izin verir. */
export const BypassSchoolModuleGuard = () =>
  SetMetadata(BYPASS_SCHOOL_MODULE_GUARD_KEY, true);
