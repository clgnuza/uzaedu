import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLog } from './entities/audit-log.entity';

/** Kaç günden eski loglar silinsin. 90 = son 3 ay. */
const RETENTION_DAYS = 90;

export interface ListAuditLogsParams {
  schoolId: string;
  action?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async list(params: ListAuditLogsParams): Promise<{ total: number; page: number; limit: number; items: AuditLog[] }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 100);
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .where('a.school_id = :schoolId', { schoolId: params.schoolId })
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (params.action) qb.andWhere('a.action = :action', { action: params.action });
    if (params.from) qb.andWhere('a.created_at >= :from', { from: params.from });
    if (params.to) qb.andWhere('a.created_at <= :to', { to: params.to });

    const [items, total] = await qb.getManyAndCount();
    const safeItems = items.map((a) => ({
      ...a,
      user: a.user ? { display_name: a.user.display_name, email: a.user.email } : null,
    }));
    return { total, page, limit, items: safeItems as AuditLog[] };
  }

  async log(params: {
    action: string;
    userId?: string | null;
    schoolId?: string | null;
    ip?: string | null;
    meta?: Record<string, unknown> | null;
  }): Promise<void> {
    const entry = this.auditRepo.create({
      action: params.action,
      user_id: params.userId ?? null,
      school_id: params.schoolId ?? null,
      ip: params.ip ?? null,
      meta: params.meta ?? null,
    });
    await this.auditRepo.save(entry).catch(() => {
      // Audit log failure should not break the main flow
    });
  }

  /**
   * Her gün 03:00'te 90 günden eski logları siler. Tabloyu şişmesinden korur.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const result = await this.auditRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute();
    if (result.affected && result.affected > 0) {
      console.log(`[AuditService] ${result.affected} adet eski log silindi (${cutoff.toISOString().slice(0, 10)} öncesi)`);
    }
  }
}
