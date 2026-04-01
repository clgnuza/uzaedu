import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketUsageLedger } from './entities/market-usage-ledger.entity';
import { UserRole } from '../types/enums';

function parseLedgerNum(v: string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function toSqlAmount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  return (Math.round(n * 1e6) / 1e6).toFixed(6);
}

/** node-pg / sürücü farklı tipler döndürebilir; geçersizse fallback (UTC ay/yıl sonu). */
function pgTimestampToIso(value: unknown, fallback: Date): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (value !== undefined && value !== null) {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback.toISOString();
}

export type UsageSlice = {
  period_label: string;
  jeton: number;
  ekders: number;
};

export type UsageModuleSlice = UsageSlice & {
  by_module: Record<string, { jeton: number; ekders: number }>;
};

export type MarketUsageBreakdown = {
  periods: {
    month: { label: string; starts_at: string; ends_at: string };
    year: { label: string; starts_at: string; ends_at: string };
  };
  user: { month: UsageModuleSlice; year: UsageModuleSlice };
  school: { month: UsageModuleSlice; year: UsageModuleSlice } | null;
};

@Injectable()
export class MarketUsageService {
  constructor(
    @InjectRepository(MarketUsageLedger)
    private readonly repo: Repository<MarketUsageLedger>,
  ) {}

  async recordDebit(params: {
    userId: string;
    schoolId: string | null;
    debitTarget: 'user' | 'school';
    moduleKey: string;
    jeton: number;
    ekders: number;
  }): Promise<void> {
    const j = toSqlAmount(params.jeton);
    const e = toSqlAmount(params.ekders);
    if (j === '0.000000' && e === '0.000000') return;
    await this.repo.insert({
      userId: params.userId,
      schoolId: params.debitTarget === 'school' ? params.schoolId : null,
      debitTarget: params.debitTarget,
      moduleKey: params.moduleKey.slice(0, 32),
      jetonDebit: j,
      ekdersDebit: e,
    });
  }

  async getSummary(params: {
    userId: string;
    schoolId: string | null;
    role: UserRole;
  }): Promise<{
    user: { month: UsageSlice; year: UsageSlice };
    school: { month: UsageSlice; year: UsageSlice } | null;
  }> {
    const now = new Date();
    const monthLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const yearLabel = String(now.getUTCFullYear());

    const [userMonth, userYear] = await Promise.all([
      this.sumRange({
        debitTarget: 'user',
        userId: params.userId,
        schoolId: null,
        period: 'month',
      }),
      this.sumRange({
        debitTarget: 'user',
        userId: params.userId,
        schoolId: null,
        period: 'year',
      }),
    ]);

    let school: { month: UsageSlice; year: UsageSlice } | null = null;
    if (params.role === UserRole.school_admin && params.schoolId) {
      const [sm, sy] = await Promise.all([
        this.sumRange({
          debitTarget: 'school',
          userId: null,
          schoolId: params.schoolId,
          period: 'month',
        }),
        this.sumRange({
          debitTarget: 'school',
          userId: null,
          schoolId: params.schoolId,
          period: 'year',
        }),
      ]);
      school = {
        month: { period_label: monthLabel, ...sm },
        year: { period_label: yearLabel, ...sy },
      };
    }

    return {
      user: {
        month: { period_label: monthLabel, ...userMonth },
        year: { period_label: yearLabel, ...userYear },
      },
      school,
    };
  }

  /** Öğretmen + (varsa) okul: modül bazlı harcama; ay/yıl dönem bitiş zamanları (ISO). */
  async getBreakdown(params: {
    userId: string;
    schoolId: string | null;
    role: UserRole;
  }): Promise<MarketUsageBreakdown> {
    const now = new Date();
    const monthLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const yearLabel = String(now.getUTCFullYear());

    const periodRows = await this.repo.query(`
      SELECT
        to_char(date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), 'YYYY-MM') AS month_lbl,
        date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS month_start,
        (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 month') AS month_end,
        to_char(date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), 'YYYY') AS year_lbl,
        date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS year_start,
        (date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 year') AS year_end
    `);
    const pr = periodRows?.[0];
    const fbMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const fbMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    const fbYearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const fbYearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
    const monthStartIso = pgTimestampToIso(pr?.month_start, fbMonthStart);
    const monthEndIso = pgTimestampToIso(pr?.month_end, fbMonthEnd);
    const yearStartIso = pgTimestampToIso(pr?.year_start, fbYearStart);
    const yearEndIso = pgTimestampToIso(pr?.year_end, fbYearEnd);

    const [
      umMod,
      uyMod,
      umTot,
      uyTot,
      smMod,
      syMod,
      smTot,
      syTot,
    ] = await Promise.all([
      this.sumByModule({
        debitTarget: 'user',
        userId: params.userId,
        schoolId: null,
        period: 'month',
      }),
      this.sumByModule({
        debitTarget: 'user',
        userId: params.userId,
        schoolId: null,
        period: 'year',
      }),
      this.sumRange({
        debitTarget: 'user',
        userId: params.userId,
        schoolId: null,
        period: 'month',
      }),
      this.sumRange({
        debitTarget: 'user',
        userId: params.userId,
        schoolId: null,
        period: 'year',
      }),
      params.role === UserRole.school_admin && params.schoolId
        ? this.sumByModule({
            debitTarget: 'school',
            userId: null,
            schoolId: params.schoolId,
            period: 'month',
          })
        : Promise.resolve({} as Record<string, { jeton: number; ekders: number }>),
      params.role === UserRole.school_admin && params.schoolId
        ? this.sumByModule({
            debitTarget: 'school',
            userId: null,
            schoolId: params.schoolId,
            period: 'year',
          })
        : Promise.resolve({} as Record<string, { jeton: number; ekders: number }>),
      params.role === UserRole.school_admin && params.schoolId
        ? this.sumRange({
            debitTarget: 'school',
            userId: null,
            schoolId: params.schoolId,
            period: 'month',
          })
        : Promise.resolve({ jeton: 0, ekders: 0 }),
      params.role === UserRole.school_admin && params.schoolId
        ? this.sumRange({
            debitTarget: 'school',
            userId: null,
            schoolId: params.schoolId,
            period: 'year',
          })
        : Promise.resolve({ jeton: 0, ekders: 0 }),
    ]);

    let school: MarketUsageBreakdown['school'] = null;
    if (params.role === UserRole.school_admin && params.schoolId) {
      school = {
        month: { period_label: monthLabel, ...smTot, by_module: smMod },
        year: { period_label: yearLabel, ...syTot, by_module: syMod },
      };
    }

    return {
      periods: {
        month: { label: String(pr?.month_lbl ?? monthLabel), starts_at: monthStartIso, ends_at: monthEndIso },
        year: { label: String(pr?.year_lbl ?? yearLabel), starts_at: yearStartIso, ends_at: yearEndIso },
      },
      user: {
        month: { period_label: monthLabel, ...umTot, by_module: umMod },
        year: { period_label: yearLabel, ...uyTot, by_module: uyMod },
      },
      school,
    };
  }

  private async sumByModule(opts: {
    debitTarget: 'user' | 'school';
    userId: string | null;
    schoolId: string | null;
    period: 'month' | 'year';
  }): Promise<Record<string, { jeton: number; ekders: number }>> {
    const bounds =
      opts.period === 'month'
        ? {
            from: `date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
            to: `date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 month'`,
          }
        : {
            from: `date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
            to: `date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 year'`,
          };

    let where: string;
    const p: unknown[] = [];
    if (opts.debitTarget === 'user') {
      p.push(opts.userId);
      where = `debit_target = 'user' AND user_id = $1`;
    } else {
      p.push(opts.schoolId);
      where = `debit_target = 'school' AND school_id = $1`;
    }

    const sql = `
      SELECT module_key,
        COALESCE(SUM(jeton_debit), 0)::text AS jeton,
        COALESCE(SUM(ekders_debit), 0)::text AS ekders
      FROM market_usage_ledger
      WHERE ${where}
        AND created_at >= ${bounds.from}
        AND created_at < ${bounds.to}
      GROUP BY module_key
    `;
    const rows = await this.repo.query(sql, p);
    const out: Record<string, { jeton: number; ekders: number }> = {};
    for (const r of rows || []) {
      const k = String(r.module_key ?? '').trim();
      if (!k) continue;
      out[k] = {
        jeton: parseLedgerNum(r.jeton),
        ekders: parseLedgerNum(r.ekders),
      };
    }
    return out;
  }

  private async sumRange(opts: {
    debitTarget: 'user' | 'school';
    userId: string | null;
    schoolId: string | null;
    period: 'month' | 'year';
  }): Promise<{ jeton: number; ekders: number }> {
    const bounds =
      opts.period === 'month'
        ? {
            from: `date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
            to: `date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 month'`,
          }
        : {
            from: `date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
            to: `date_trunc('year', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 year'`,
          };

    let where: string;
    const p: unknown[] = [];
    if (opts.debitTarget === 'user') {
      p.push(opts.userId);
      where = `debit_target = 'user' AND user_id = $1`;
    } else {
      p.push(opts.schoolId);
      where = `debit_target = 'school' AND school_id = $1`;
    }

    const sql = `
      SELECT
        COALESCE(SUM(jeton_debit), 0)::text AS jeton,
        COALESCE(SUM(ekders_debit), 0)::text AS ekders
      FROM market_usage_ledger
      WHERE ${where}
        AND created_at >= ${bounds.from}
        AND created_at < ${bounds.to}
    `;
    const rows = await this.repo.query(sql, p);
    const row = rows?.[0];
    return {
      jeton: parseLedgerNum(row?.jeton),
      ekders: parseLedgerNum(row?.ekders),
    };
  }

  /** Superadmin: tüm kullanıcı/okul modül tüketim kayıtları (sayfalı). */
  async listAllConsumptionLedger(params: { page: number; limit: number }): Promise<{
    total: number;
    items: MarketUsageLedger[];
  }> {
    const limit = Math.min(100, Math.max(1, params.limit));
    const page = Math.max(1, params.page);
    const qb = this.repo.createQueryBuilder('u').orderBy('u.createdAt', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { total, items };
  }

  async listLedger(
    userId: string,
    scope: 'user' | 'school',
    schoolId: string | null,
    page: number,
    limit: number,
  ): Promise<{ total: number; items: MarketUsageLedger[] }> {
    const qb = this.repo.createQueryBuilder('u');
    if (scope === 'school' && schoolId) {
      qb.where('u.debitTarget = :dt AND u.schoolId = :sid', { dt: 'school', sid: schoolId });
    } else {
      qb.where('u.debitTarget = :dt AND u.userId = :uid', { dt: 'user', uid: userId });
    }
    qb.orderBy('u.createdAt', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { total, items };
  }

  /** Superadmin: tüm platform modül tüketimi (cüzdandan düşüm) — ay / yıl. */
  async getPlatformConsumptionForRange(start: Date, end: Date): Promise<{
    user: { jeton: number; ekders: number };
    school: { jeton: number; ekders: number };
  }> {
    const rows = await this.repo.query(
      `SELECT
        COALESCE(SUM(CASE WHEN debit_target = 'user' THEN jeton_debit ELSE 0 END), 0)::text AS ju,
        COALESCE(SUM(CASE WHEN debit_target = 'school' THEN jeton_debit ELSE 0 END), 0)::text AS js,
        COALESCE(SUM(CASE WHEN debit_target = 'user' THEN ekders_debit ELSE 0 END), 0)::text AS eu,
        COALESCE(SUM(CASE WHEN debit_target = 'school' THEN ekders_debit ELSE 0 END), 0)::text AS es
      FROM market_usage_ledger
      WHERE created_at >= $1 AND created_at < $2`,
      [start, end],
    );
    const row = rows?.[0];
    return {
      user: { jeton: parseLedgerNum(row?.ju), ekders: parseLedgerNum(row?.eu) },
      school: { jeton: parseLedgerNum(row?.js), ekders: parseLedgerNum(row?.es) },
    };
  }
}
