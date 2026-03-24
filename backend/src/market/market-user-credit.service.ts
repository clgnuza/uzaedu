import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { MarketUserCreditLedger } from './entities/market-user-credit-ledger.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { NotificationsService } from '../notifications/notifications.service';

function toSqlAmount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  return (Math.round(n * 1e6) / 1e6).toFixed(6);
}

function parseNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class MarketUserCreditService {
  constructor(
    @InjectRepository(MarketUserCreditLedger)
    private readonly ledgerRepo: Repository<MarketUserCreditLedger>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async applyCredit(params: {
    targetUserId: string;
    createdByUserId: string;
    jeton: number;
    ekders: number;
    note?: string | null;
  }): Promise<MarketUserCreditLedger> {
    const j = toSqlAmount(params.jeton);
    const e = toSqlAmount(params.ekders);
    if (j === '0.000000' && e === '0.000000') {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'En az biri: jeton veya ek ders miktarı 0’dan büyük olmalıdır.',
      });
    }

    const target = await this.userRepo.findOne({
      where: { id: params.targetUserId },
      select: ['id', 'role'],
    });
    if (!target) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' });
    }
    if (target.role !== UserRole.teacher) {
      throw new BadRequestException({
        code: 'INVALID_TARGET_ROLE',
        message: 'Manuel yükleme yalnızca öğretmen hesapları için yapılabilir.',
      });
    }

    const row = await this.dataSource.transaction(async (em) => {
      await em.query(
        `UPDATE users SET
          market_jeton_balance = COALESCE(market_jeton_balance, 0)::numeric + $1::numeric,
          market_ekders_balance = COALESCE(market_ekders_balance, 0)::numeric + $2::numeric
        WHERE id = $3`,
        [j, e, params.targetUserId],
      );
      const created = em.create(MarketUserCreditLedger, {
        targetUserId: params.targetUserId,
        createdByUserId: params.createdByUserId,
        jetonCredit: j,
        ekdersCredit: e,
        note: params.note?.trim() ? params.note.trim().slice(0, 500) : null,
      });
      return em.save(MarketUserCreditLedger, created);
    });
    void this.notifyTeacherAfterCredit(params.targetUserId, params.note ?? null, row).catch(() => {});
    return row;
  }

  private async notifyTeacherAfterCredit(
    targetUserId: string,
    note: string | null,
    row: MarketUserCreditLedger,
  ): Promise<void> {
    const jNum = parseNum(row.jetonCredit);
    const eNum = parseNum(row.ekdersCredit);
    const amtParts: string[] = [];
    if (jNum > 0) amtParts.push(`${jNum} jeton`);
    if (eNum > 0) amtParts.push(`${eNum} ek ders`);
    const noteLine = note?.trim();
    const body = `${amtParts.join(' ve ')} bireysel cüzdanınıza eklendi.${noteLine ? ` Not: ${noteLine}` : ''}`;
    await this.notificationsService.createInboxEntry({
      user_id: targetUserId,
      event_type: 'market.user_credit_added',
      entity_id: row.id,
      target_screen: 'market',
      title: 'Bireysel cüzdanınıza bakiye yüklendi',
      body,
      metadata: {
        jeton_credit: jNum,
        ekders_credit: eNum,
        ledger_id: row.id,
      },
    });
  }

  async listHistory(params: {
    targetUserId: string;
    fromInclusive?: Date | null;
    toInclusive?: Date | null;
    page: number;
    limit: number;
  }): Promise<{
    total: number;
    items: Array<{
      id: string;
      jeton_credit: number;
      ekders_credit: number;
      note: string | null;
      created_at: string;
      created_by_user_id: string;
      creator_email: string | null;
      creator_display_name: string | null;
    }>;
  }> {
    const limit = Math.min(100, Math.max(1, params.limit));
    const page = Math.max(1, params.page);
    const makeBase = () => {
      const q = this.ledgerRepo.createQueryBuilder('c').where('c.targetUserId = :uid', { uid: params.targetUserId });
      if (params.fromInclusive) {
        q.andWhere('c.createdAt >= :from', { from: params.fromInclusive });
      }
      if (params.toInclusive) {
        q.andWhere('c.createdAt <= :to', { to: params.toInclusive });
      }
      return q;
    };
    const total = await makeBase().getCount();
    const rows = await makeBase()
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    if (rows.length === 0) {
      return { total, items: [] };
    }

    const creatorIds = [...new Set(rows.map((r) => r.createdByUserId))];
    const users =
      creatorIds.length === 0
        ? []
        : await this.dataSource.query<{ id: string; email: string | null; display_name: string | null }[]>(
            `SELECT id, email, display_name FROM users WHERE id = ANY($1::uuid[])`,
            [creatorIds],
          );
    const umap = new Map(users.map((u) => [u.id, u]));

    return {
      total,
      items: rows.map((r) => {
        const u = umap.get(r.createdByUserId);
        return {
          id: r.id,
          jeton_credit: parseNum(r.jetonCredit),
          ekders_credit: parseNum(r.ekdersCredit),
          note: r.note,
          created_at: r.createdAt?.toISOString?.() ?? '',
          created_by_user_id: r.createdByUserId,
          creator_email: u?.email ?? null,
          creator_display_name: u?.display_name ?? null,
        };
      }),
    };
  }

  async listAllPlatform(params: {
    targetUserId?: string | null;
    fromInclusive?: Date | null;
    toInclusive?: Date | null;
    page: number;
    limit: number;
  }): Promise<{
    total: number;
    items: Array<{
      id: string;
      target_user_id: string;
      target_email: string | null;
      target_display_name: string | null;
      jeton_credit: number;
      ekders_credit: number;
      note: string | null;
      created_at: string;
      created_by_user_id: string;
      creator_email: string | null;
      creator_display_name: string | null;
    }>;
  }> {
    const limit = Math.min(100, Math.max(1, params.limit));
    const page = Math.max(1, params.page);
    const makeBase = () => {
      const q = this.ledgerRepo.createQueryBuilder('c');
      if (params.targetUserId?.trim()) {
        q.andWhere('c.targetUserId = :tid', { tid: params.targetUserId.trim() });
      }
      if (params.fromInclusive) {
        q.andWhere('c.createdAt >= :from', { from: params.fromInclusive });
      }
      if (params.toInclusive) {
        q.andWhere('c.createdAt <= :to', { to: params.toInclusive });
      }
      return q;
    };
    const total = await makeBase().getCount();
    const rows = await makeBase()
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    if (rows.length === 0) {
      return { total, items: [] };
    }

    const creatorIds = [...new Set(rows.map((r) => r.createdByUserId))];
    const targetIds = [...new Set(rows.map((r) => r.targetUserId))];
    const [creators, targets] = await Promise.all([
      creatorIds.length === 0
        ? Promise.resolve([] as { id: string; email: string | null; display_name: string | null }[])
        : this.dataSource.query(`SELECT id, email, display_name FROM users WHERE id = ANY($1::uuid[])`, [creatorIds]),
      targetIds.length === 0
        ? Promise.resolve([] as User[])
        : this.userRepo.find({
            where: { id: In(targetIds) },
            select: ['id', 'email', 'display_name'],
          }),
    ]);
    const cmap = new Map(creators.map((u: { id: string }) => [u.id, u]));
    const tmap = new Map(targets.map((u) => [u.id, u]));

    return {
      total,
      items: rows.map((r) => {
        const c = cmap.get(r.createdByUserId) as { email?: string | null; display_name?: string | null } | undefined;
        const t = tmap.get(r.targetUserId);
        return {
          id: r.id,
          target_user_id: r.targetUserId,
          target_email: t?.email ?? null,
          target_display_name: t?.display_name ?? null,
          jeton_credit: parseNum(r.jetonCredit),
          ekders_credit: parseNum(r.ekdersCredit),
          note: r.note,
          created_at: r.createdAt?.toISOString?.() ?? '',
          created_by_user_id: r.createdByUserId,
          creator_email: c?.email ?? null,
          creator_display_name: c?.display_name ?? null,
        };
      }),
    };
  }
}
