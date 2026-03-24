import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { UserRole } from '../types/enums';

@Injectable()
export class MarketWalletService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async getBalancesForActor(params: {
    userId: string;
    schoolId: string | null;
    role: UserRole;
  }): Promise<{
    user: { jeton: number; ekders: number };
    school: { jeton: number; ekders: number } | null;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: params.userId },
      select: ['id', 'marketJetonBalance', 'marketEkdersBalance'],
    });
    const uj = parseNum(user?.marketJetonBalance);
    const ue = parseNum(user?.marketEkdersBalance);

    let school: { jeton: number; ekders: number } | null = null;
    if (
      params.role === UserRole.school_admin &&
      params.schoolId &&
      (await this.schoolRepo.exist({ where: { id: params.schoolId } }))
    ) {
      const s = await this.schoolRepo.findOne({
        where: { id: params.schoolId },
        select: ['id', 'marketJetonBalance', 'marketEkdersBalance'],
      });
      if (s) {
        school = { jeton: parseNum(s.marketJetonBalance), ekders: parseNum(s.marketEkdersBalance) };
      }
    }

    return {
      user: { jeton: uj, ekders: ue },
      school,
    };
  }

  /**
   * Doğrulanmış satın alma sonrası bakiye ekleme.
   */
  async applyCredit(params: {
    userId: string;
    schoolId: string | null;
    role: UserRole;
    creditAccount: 'user' | 'school';
    currencyKind: 'jeton' | 'ekders';
    amount: number;
  }): Promise<void> {
    const amt = Math.max(0, params.amount);
    if (amt <= 0 || !Number.isFinite(amt)) return;

    if (params.creditAccount === 'school') {
      if (params.role !== UserRole.school_admin) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul cüzdanına sadece okul yöneticisi yükleyebilir.' });
      }
      if (!params.schoolId) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilgisi yok.' });
      }
      const col = params.currencyKind === 'jeton' ? 'market_jeton_balance' : 'market_ekders_balance';
      await this.schoolRepo.query(
        `UPDATE schools SET ${col} = COALESCE(${col}, 0) + $1::numeric WHERE id = $2`,
        [String(amt), params.schoolId],
      );
      return;
    }

    const col = params.currencyKind === 'jeton' ? 'market_jeton_balance' : 'market_ekders_balance';
    await this.userRepo.query(
      `UPDATE users SET ${col} = COALESCE(${col}, 0) + $1::numeric WHERE id = $2`,
      [String(amt), params.userId],
    );
  }

  /**
   * Atomik düşüm; yetersiz bakiyede false.
   */
  async tryDebitUser(
    userId: string,
    cost: { jeton: number; ekders: number },
  ): Promise<boolean> {
    const j = toSqlNumeric(cost.jeton);
    const e = toSqlNumeric(cost.ekders);
    const r = await this.userRepo.query(
      `UPDATE users SET
        market_jeton_balance = COALESCE(market_jeton_balance, 0)::numeric - $1::numeric,
        market_ekders_balance = COALESCE(market_ekders_balance, 0)::numeric - $2::numeric
      WHERE id = $3
        AND COALESCE(market_jeton_balance, 0)::numeric >= $1::numeric
        AND COALESCE(market_ekders_balance, 0)::numeric >= $2::numeric
      RETURNING id`,
      [j, e, userId],
    );
    return Array.isArray(r) && r.length > 0;
  }

  async tryDebitSchool(
    schoolId: string,
    cost: { jeton: number; ekders: number },
  ): Promise<boolean> {
    const j = toSqlNumeric(cost.jeton);
    const e = toSqlNumeric(cost.ekders);
    const r = await this.schoolRepo.query(
      `UPDATE schools SET
        market_jeton_balance = COALESCE(market_jeton_balance, 0)::numeric - $1::numeric,
        market_ekders_balance = COALESCE(market_ekders_balance, 0)::numeric - $2::numeric
      WHERE id = $3
        AND COALESCE(market_jeton_balance, 0)::numeric >= $1::numeric
        AND COALESCE(market_ekders_balance, 0)::numeric >= $2::numeric
      RETURNING id`,
      [j, e, schoolId],
    );
    return Array.isArray(r) && r.length > 0;
  }
}

function toSqlNumeric(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  return (Math.round(n * 1e6) / 1e6).toFixed(6);
}

function parseNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
