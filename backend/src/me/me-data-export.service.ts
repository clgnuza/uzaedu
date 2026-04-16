import { BadRequestException, Injectable } from '@nestjs/common';
import { MARKET_MODULE_KEYS, type MarketModuleKey } from '../app-config/market-policy.defaults';
import { UsersService } from '../users/users.service';
import { TeacherAgendaService } from '../teacher-agenda/teacher-agenda.service';
import { MeUserModuleSnapshotsService } from './me-user-module-snapshots.service';

const EXPORT_MODULE_IDS = ['account', ...MARKET_MODULE_KEYS] as const;
type ExportModuleId = (typeof EXPORT_MODULE_IDS)[number];

const EXPORT_SET = new Set<string>(EXPORT_MODULE_IDS);

@Injectable()
export class MeDataExportService {
  constructor(
    private readonly usersService: UsersService,
    private readonly teacherAgendaService: TeacherAgendaService,
    private readonly userModuleSnapshots: MeUserModuleSnapshotsService,
  ) {}

  parseModulesQuery(raw: string | undefined): 'legacy' | ExportModuleId[] {
    if (raw === undefined || raw === null || String(raw).trim() === '') return 'legacy';
    const parts = String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = parts.filter((p) => !EXPORT_SET.has(p));
    if (invalid.length) {
      throw new BadRequestException({
        code: 'INVALID_MODULES',
        message: `Geçersiz modül: ${invalid.join(', ')}`,
      });
    }
    if (parts.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_MODULES',
        message: 'En az bir modül seçin.',
      });
    }
    return [...new Set(parts)] as ExportModuleId[];
  }

  async export(
    userId: string,
    modulesQuery: string | undefined,
  ): Promise<Record<string, unknown>> {
    const mode = this.parseModulesQuery(modulesQuery);
    if (mode === 'legacy') {
      return this.usersService.exportUserData(userId);
    }

    const out: Record<string, unknown> = {
      export_version: 2,
      exported_at: new Date().toISOString(),
      modules: mode,
    };

    for (const key of mode) {
      if (key === 'account') {
        out.account = await this.usersService.exportUserData(userId);
      } else if (key === 'teacher_agenda') {
        out.teacher_agenda = await this.teacherAgendaService.exportFullDataSnapshot(userId);
      } else if (this.userModuleSnapshots.isExportableModule(key)) {
        out[key] = await this.userModuleSnapshots.snapshot(userId, key as MarketModuleKey);
      } else {
        out[key] = { unavailable: true };
      }
    }

    return out;
  }
}
