import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MARKET_MODULE_KEYS } from '../app-config/market-policy.defaults';
import { UsersService } from '../users/users.service';
import { TeacherAgendaImportService } from '../teacher-agenda/teacher-agenda-import.service';
import { MessagingUserPreference } from '../messaging/entities/messaging-user-preference.entity';

const IMPORT_MODULE_IDS = ['account', ...MARKET_MODULE_KEYS] as const;
const IMPORT_SET = new Set<string>(IMPORT_MODULE_IDS);

@Injectable()
export class MeDataImportService {
  constructor(
    private readonly usersService: UsersService,
    private readonly teacherAgendaImportService: TeacherAgendaImportService,
    @InjectRepository(MessagingUserPreference)
    private readonly messagingUserPrefRepo: Repository<MessagingUserPreference>,
  ) {}

  async importBackup(
    userId: string,
    body: unknown,
    modulesQuery: string | undefined,
  ): Promise<{ imported: string[] }> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException({ code: 'INVALID_BODY', message: 'Geçersiz istek gövdesi.' });
    }
    const data = body as Record<string, unknown>;

    const requested = this.resolveModules(modulesQuery, data);
    this.assertBackupOwnership(userId, data, requested);
    const imported: string[] = [];

    for (const mod of requested) {
      if (mod === 'account') {
        const acc =
          data.export_version === 2
            ? (data.account as Record<string, unknown> | undefined)
            : (data as Record<string, unknown>);
        if (acc && typeof acc === 'object') {
          await this.usersService.applyAccountFromExport(userId, acc);
          imported.push('account');
        }
      } else if (mod === 'teacher_agenda') {
        const ta = data.teacher_agenda as Record<string, unknown> | undefined;
        if (ta && typeof ta === 'object' && !this.isUnavailable(ta)) {
          const user = await this.usersService.findById(userId);
          await this.teacherAgendaImportService.importFromSnapshot(userId, user.school_id ?? null, ta);
          imported.push('teacher_agenda');
        }
      } else if (mod === 'messaging') {
        const block = data.messaging as Record<string, unknown> | undefined;
        if (block && typeof block === 'object' && !this.isUnavailable(block)) {
          const n = await this.importMessagingPreferences(userId, block);
          if (n > 0) imported.push('messaging');
        }
      }
    }

    if (imported.length === 0) {
      throw new BadRequestException({
        code: 'NOTHING_IMPORTED',
        message: 'Seçilen modüller yedekte yok veya henüz içe aktarılamıyor.',
      });
    }

    return { imported };
  }

  private isUnavailable(obj: Record<string, unknown>): boolean {
    return obj.unavailable === true;
  }

  /** Yazılan satır sayısı (0 ise sunucu değişmedi). */
  private async importMessagingPreferences(userId: string, block: Record<string, unknown>): Promise<number> {
    const snap = block.snapshot_user_id ?? block.user_id;
    if (typeof snap === 'string' && snap !== userId) {
      throw new ForbiddenException({
        code: 'BACKUP_USER_MISMATCH',
        message: 'Mesajlaşma tercihleri yedeği başka kullanıcıya ait.',
      });
    }
    const raw = block.messaging_user_preferences;
    if (!Array.isArray(raw) || raw.length === 0) return 0;
    const rows = raw.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
    if (rows.length === 0) return 0;
    for (const r of rows) {
      const uid = typeof r.userId === 'string' ? r.userId : typeof r.user_id === 'string' ? r.user_id : null;
      if (uid && uid !== userId) {
        throw new ForbiddenException({
          code: 'BACKUP_USER_MISMATCH',
          message: 'Mesajlaşma tercihleri satırı başka kullanıcıya ait.',
        });
      }
    }
    await this.messagingUserPrefRepo.delete({ userId });
    let written = 0;
    for (const r of rows) {
      const schoolId = typeof r.schoolId === 'string' ? r.schoolId : typeof r.school_id === 'string' ? r.school_id : null;
      if (!schoolId) continue;
      const prefs =
        r.preferences && typeof r.preferences === 'object' ? (r.preferences as Record<string, unknown>) : {};
      await this.messagingUserPrefRepo.save(
        this.messagingUserPrefRepo.create({
          userId,
          schoolId,
          preferences: JSON.parse(JSON.stringify(prefs)) as Record<string, unknown>,
        }),
      );
      written++;
    }
    return written;
  }

  private accountIdFromBackup(data: Record<string, unknown>): string | null {
    if (data.export_version === 2) {
      const acc = data.account as Record<string, unknown> | undefined;
      if (acc && typeof acc === 'object' && typeof acc.id === 'string') return acc.id;
      return null;
    }
    return typeof data.id === 'string' ? data.id : null;
  }

  /**
   * Yabancı veya tanınmayan JSON’ların sessizce uygulanmasını engeller:
   * hesap için dosyada oturumla eşleşen kullanıcı kimliği zorunlu; ajanda için snapshot_user_id veya
   * satırlarda tutarlı kullanıcı alanları + gerekirse aynı dosyadaki hesap bloğu.
   */
  private assertBackupOwnership(userId: string, data: Record<string, unknown>, requested: string[]): void {
    const accId = this.accountIdFromBackup(data);
    if (accId && accId !== userId) {
      throw new ForbiddenException({
        code: 'BACKUP_USER_MISMATCH',
        message: 'Bu yedek başka bir kullanıcıya ait. Yalnızca kendi dışa aktardığınız dosyayı yükleyebilirsiniz.',
      });
    }

    if (requested.includes('account')) {
      if (!accId || accId !== userId) {
        throw new ForbiddenException({
          code: 'BACKUP_USER_MISMATCH',
          message:
            'Bu dosya tanınan bir ÖğretmenPro hesap yedeği değil veya hesap bilgisi oturumunuzla eşleşmiyor. Yalnızca kendi dışa aktardığınız JSON’u kullanın.',
        });
      }
    }

    if (requested.includes('messaging')) {
      const msg = data.messaging as Record<string, unknown> | undefined;
      if (msg && typeof msg === 'object' && !this.isUnavailable(msg)) {
        const snap = msg.snapshot_user_id ?? msg.user_id;
        if (typeof snap === 'string' && snap !== userId) {
          throw new ForbiddenException({
            code: 'BACKUP_USER_MISMATCH',
            message: 'Mesajlaşma yedeği başka kullanıcıya ait.',
          });
        }
      }
    }

    if (!requested.includes('teacher_agenda')) return;

    const ta = data.teacher_agenda as Record<string, unknown> | undefined;
    if (!ta || typeof ta !== 'object' || this.isUnavailable(ta)) return;

    const snapOwner = ta.snapshot_user_id ?? ta.user_id;
    if (typeof snapOwner === 'string') {
      if (snapOwner !== userId) {
        throw new ForbiddenException({
          code: 'BACKUP_USER_MISMATCH',
          message: 'Bu ajanda yedeği başka bir kullanıcıya ait.',
        });
      }
      return;
    }

    this.assertAgendaRowsBelongToUser(userId, ta);
    if (!this.agendaSnapshotShowsOwner(userId, ta)) {
      if (accId === userId) return;
      throw new ForbiddenException({
        code: 'BACKUP_USER_MISMATCH',
        message:
          'Ajanda yedeğinin bu hesaba ait olduğu doğrulanamadı. Yalnızca kendi dışa aktardığınız dosyayı kullanın (güncel yedek alın).',
      });
    }
  }

  /** Dışa aktarımdaki bilinen koleksiyonlar: başka kullanıcıya ait satır varsa reddet. */
  private assertAgendaRowsBelongToUser(userId: string, ta: Record<string, unknown>): void {
    const collections: { key: keyof typeof ta; fields: string[] }[] = [
      { key: 'notes', fields: ['userId', 'user_id'] },
      { key: 'tasks', fields: ['userId', 'user_id'] },
      { key: 'student_notes', fields: ['teacherId', 'teacher_id'] },
      { key: 'parent_meetings', fields: ['teacherId', 'teacher_id'] },
      { key: 'evaluation_criteria', fields: ['teacherId', 'teacher_id'] },
      { key: 'student_lists', fields: ['teacherId', 'teacher_id'] },
      { key: 'evaluation_scores', fields: ['teacherId', 'teacher_id'] },
      { key: 'platform_events', fields: ['createdBy', 'created_by'] },
      { key: 'templates', fields: ['userId', 'user_id'] },
      { key: 'school_events', fields: ['createdBy', 'created_by'] },
      { key: 'school_event_assignments', fields: ['userId', 'user_id'] },
    ];
    for (const { key, fields } of collections) {
      const arr = Array.isArray(ta[key]) ? (ta[key] as unknown[]) : [];
      for (const row of arr) {
        if (!row || typeof row !== 'object') continue;
        const o = row as Record<string, unknown>;
        for (const f of fields) {
          const v = o[f];
          if (typeof v === 'string' && v && v !== userId) {
            throw new ForbiddenException({
              code: 'BACKUP_USER_MISMATCH',
              message: 'Bu ajanda yedeği başka bir kullanıcıya ait görünüyor.',
            });
          }
        }
      }
    }
  }

  /** En az bir satırda mevcut kullanıcı kimliği görünür mü (eski yedekler; snapshot_user_id yoksa). */
  private agendaSnapshotShowsOwner(userId: string, ta: Record<string, unknown>): boolean {
    const tryRow = (row: unknown, fields: string[]): boolean => {
      if (!row || typeof row !== 'object') return false;
      const o = row as Record<string, unknown>;
      for (const f of fields) {
        const v = o[f];
        if (v === userId) return true;
      }
      return false;
    };
    const blocks: { key: keyof typeof ta; fields: string[] }[] = [
      { key: 'notes', fields: ['userId', 'user_id'] },
      { key: 'tasks', fields: ['userId', 'user_id'] },
      { key: 'student_notes', fields: ['teacherId', 'teacher_id'] },
      { key: 'parent_meetings', fields: ['teacherId', 'teacher_id'] },
      { key: 'evaluation_criteria', fields: ['teacherId', 'teacher_id'] },
      { key: 'student_lists', fields: ['teacherId', 'teacher_id'] },
      { key: 'evaluation_scores', fields: ['teacherId', 'teacher_id'] },
      { key: 'platform_events', fields: ['createdBy', 'created_by'] },
      { key: 'templates', fields: ['userId', 'user_id'] },
      { key: 'school_events', fields: ['createdBy', 'created_by'] },
      { key: 'school_event_assignments', fields: ['userId', 'user_id'] },
    ];
    for (const { key, fields } of blocks) {
      const arr = Array.isArray(ta[key]) ? (ta[key] as unknown[]) : [];
      for (const row of arr) {
        if (tryRow(row, fields)) return true;
      }
    }
    return false;
  }

  private resolveModules(modulesQuery: string | undefined, data: Record<string, unknown>): string[] {
    const raw = String(modulesQuery ?? '').trim();
    if (raw) {
      const parts = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const invalid = parts.filter((p) => !IMPORT_SET.has(p));
      if (invalid.length) {
        throw new BadRequestException({
          code: 'INVALID_MODULES',
          message: `Geçersiz modül: ${invalid.join(', ')}`,
        });
      }
      if (parts.length === 0) {
        throw new BadRequestException({ code: 'EMPTY_MODULES', message: 'En az bir modül seçin.' });
      }
      return [...new Set(parts)];
    }

    const fromFile = Array.isArray(data.modules) ? (data.modules as string[]).filter((m) => IMPORT_SET.has(m)) : [];
    if (fromFile.length > 0) return [...new Set(fromFile)];

    const fallback: string[] = [];
    if (data.export_version === 2 && data.account) fallback.push('account');
    if (data.export_version !== 2 && typeof data.id === 'string') fallback.push('account');
    const ta = data.teacher_agenda as Record<string, unknown> | undefined;
    if (ta && typeof ta === 'object' && !this.isUnavailable(ta)) fallback.push('teacher_agenda');

    if (fallback.length === 0) {
      throw new BadRequestException({
        code: 'NOTHING_TO_IMPORT',
        message: 'Yedekte içe aktarılabilir modül bulunamadı. ?modules=account,teacher_agenda belirtin.',
      });
    }
    return [...new Set(fallback)];
  }
}
