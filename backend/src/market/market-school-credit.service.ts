import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { MarketSchoolCreditLedger } from './entities/market-school-credit-ledger.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, UserStatus } from '../types/enums';
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
export class MarketSchoolCreditService {
  constructor(
    @InjectRepository(MarketSchoolCreditLedger)
    private readonly ledgerRepo: Repository<MarketSchoolCreditLedger>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async applyCredit(params: {
    schoolId: string;
    createdByUserId: string;
    jeton: number;
    ekders: number;
    note?: string | null;
  }): Promise<MarketSchoolCreditLedger> {
    const j = toSqlAmount(params.jeton);
    const e = toSqlAmount(params.ekders);
    if (j === '0.000000' && e === '0.000000') {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'En az biri: jeton veya ek ders miktarı 0’dan büyük olmalıdır.',
      });
    }

    const exists = await this.schoolRepo.exist({ where: { id: params.schoolId } });
    if (!exists) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    }

    const row = await this.dataSource.transaction(async (em) => {
      await em.query(
        `UPDATE schools SET
          market_jeton_balance = COALESCE(market_jeton_balance, 0)::numeric + $1::numeric,
          market_ekders_balance = COALESCE(market_ekders_balance, 0)::numeric + $2::numeric
        WHERE id = $3`,
        [j, e, params.schoolId],
      );
      const created = em.create(MarketSchoolCreditLedger, {
        schoolId: params.schoolId,
        createdByUserId: params.createdByUserId,
        jetonCredit: j,
        ekdersCredit: e,
        note: params.note?.trim() ? params.note.trim().slice(0, 500) : null,
      });
      return em.save(MarketSchoolCreditLedger, created);
    });
    void this.notifySchoolAdminsAfterCredit(params.schoolId, params.note ?? null, row).catch(() => {});
    return row;
  }

  private async notifySchoolAdminsAfterCredit(
    schoolId: string,
    note: string | null,
    row: MarketSchoolCreditLedger,
  ): Promise<void> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name'] });
    const admins = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.school_admin, status: UserStatus.active },
      select: ['id'],
    });
    if (admins.length === 0) return;
    const jNum = parseNum(row.jetonCredit);
    const eNum = parseNum(row.ekdersCredit);
    const amtParts: string[] = [];
    if (jNum > 0) amtParts.push(`${jNum} jeton`);
    if (eNum > 0) amtParts.push(`${eNum} ek ders`);
    const schoolTag = school?.name ? ` (${school.name})` : '';
    const noteLine = note?.trim();
    const body = `${amtParts.join(' ve ')}${schoolTag} okul bakiyenize eklendi.${noteLine ? ` Not: ${noteLine}` : ''}`;
    const title = 'Okul cüzdanına bakiye yüklendi';
    for (const a of admins) {
      await this.notificationsService.createInboxEntry({
        user_id: a.id,
        event_type: 'market.school_credit_added',
        entity_id: row.id,
        target_screen: 'market',
        title,
        body,
        metadata: {
          school_id: schoolId,
          jeton_credit: jNum,
          ekders_credit: eNum,
          ledger_id: row.id,
        },
      });
    }
  }

  async listHistory(params: {
    schoolId: string;
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
      const q = this.ledgerRepo.createQueryBuilder('c').where('c.schoolId = :sid', { sid: params.schoolId });
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

    const userIds = [...new Set(rows.map((r) => r.createdByUserId))];
    const users =
      userIds.length === 0
        ? []
        : await this.dataSource.query<{ id: string; email: string | null; display_name: string | null }[]>(
            `SELECT id, email, display_name FROM users WHERE id = ANY($1::uuid[])`,
            [userIds],
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

  /** Tüm okullar: superadmin manuel yükleme kayıtları (market ekranı / rapor). */
  async listAllPlatform(params: {
    schoolId?: string | null;
    fromInclusive?: Date | null;
    toInclusive?: Date | null;
    page: number;
    limit: number;
  }): Promise<{
    total: number;
    items: Array<{
      id: string;
      school_id: string;
      school_name: string | null;
      school_city: string | null;
      school_district: string | null;
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
      if (params.schoolId?.trim()) {
        q.andWhere('c.schoolId = :sid', { sid: params.schoolId.trim() });
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

    const userIds = [...new Set(rows.map((r) => r.createdByUserId))];
    const schoolIds = [...new Set(rows.map((r) => r.schoolId))];
    const [users, schools] = await Promise.all([
      userIds.length === 0
        ? Promise.resolve([] as { id: string; email: string | null; display_name: string | null }[])
        : this.dataSource.query<{ id: string; email: string | null; display_name: string | null }[]>(
            `SELECT id, email, display_name FROM users WHERE id = ANY($1::uuid[])`,
            [userIds],
          ),
      schoolIds.length === 0
        ? Promise.resolve([] as School[])
        : this.schoolRepo.find({
            where: { id: In(schoolIds) },
            select: ['id', 'name', 'city', 'district'],
          }),
    ]);
    const umap = new Map(users.map((u) => [u.id, u]));
    const smap = new Map(schools.map((s) => [s.id, s]));

    return {
      total,
      items: rows.map((r) => {
        const u = umap.get(r.createdByUserId);
        const sch = smap.get(r.schoolId);
        return {
          id: r.id,
          school_id: r.schoolId,
          school_name: sch?.name ?? null,
          school_city: sch?.city ?? null,
          school_district: sch?.district ?? null,
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
}
