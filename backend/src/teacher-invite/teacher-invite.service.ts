import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomInt } from 'crypto';
import { AppConfigService } from '../app-config/app-config.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { TeacherInviteCode } from './entities/teacher-invite-code.entity';
import { TeacherInviteRedemption } from './entities/teacher-invite-redemption.entity';
import { MarketUserCreditLedger } from '../market/entities/market-user-credit-ledger.entity';
import { NotificationsService } from '../notifications/notifications.service';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toSqlAmount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  return (Math.round(n * 1e6) / 1e6).toFixed(6);
}

function normalizeCode(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

@Injectable()
export class TeacherInviteService {
  constructor(
    @InjectRepository(TeacherInviteCode)
    private readonly codeRepo: Repository<TeacherInviteCode>,
    @InjectRepository(TeacherInviteRedemption)
    private readonly redemptionRepo: Repository<TeacherInviteRedemption>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly appConfig: AppConfigService,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  private generateCode(len: number): string {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
    }
    return s;
  }

  async ensureMyCode(inviterUserId: string): Promise<{ code: string }> {
    const policy = (await this.appConfig.getMarketPolicyConfig()).teacher_invite_jeton;
    if (!policy.enabled) {
      throw new BadRequestException({
        code: 'TEACHER_INVITE_DISABLED',
        message: 'Davetiye sistemi kapalı.',
      });
    }
    const u = await this.userRepo.findOne({ where: { id: inviterUserId }, select: ['id', 'role'] });
    if (!u || u.role !== UserRole.teacher) {
      throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Yalnızca öğretmen hesapları davet kodu alabilir.' });
    }
    const existing = await this.codeRepo.findOne({ where: { inviterUserId } });
    if (existing) return { code: existing.code };
    const len = policy.code_length;
    for (let attempt = 0; attempt < 30; attempt++) {
      const code = this.generateCode(len);
      try {
        const row = this.codeRepo.create({ inviterUserId, code });
        const saved = await this.codeRepo.save(row);
        return { code: saved.code };
      } catch {
        /* unique violation */
      }
    }
    throw new BadRequestException({ code: 'INVITE_CODE_GEN_FAILED', message: 'Davet kodu oluşturulamadı, tekrar deneyin.' });
  }

  async getMySummary(inviterUserId: string): Promise<{
    enabled: boolean;
    code: string | null;
    total_redemptions: number;
    total_inviter_jeton: number;
    policy: { jeton_for_invitee: number; jeton_for_inviter: number; max_invites_per_teacher: number };
  }> {
    const policy = (await this.appConfig.getMarketPolicyConfig()).teacher_invite_jeton;
    const row = await this.codeRepo.findOne({ where: { inviterUserId } });
    if (!row) {
      return {
        enabled: policy.enabled,
        code: null,
        total_redemptions: 0,
        total_inviter_jeton: 0,
        policy: {
          jeton_for_invitee: policy.jeton_for_invitee,
          jeton_for_inviter: policy.jeton_for_inviter,
          max_invites_per_teacher: policy.max_invites_per_teacher,
        },
      };
    }
    const cnt = await this.redemptionRepo.count({ where: { inviteCodeId: row.id } });
    const sumRaw = await this.redemptionRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.inviter_jeton), 0)', 'sumj')
      .where('r.invite_code_id = :cid', { cid: row.id })
      .getRawOne<{ sumj: string }>();
    const sumj = parseFloat(String(sumRaw?.sumj ?? '0')) || 0;
    return {
      enabled: policy.enabled,
      code: row.code,
      total_redemptions: cnt,
      total_inviter_jeton: sumj,
      policy: {
        jeton_for_invitee: policy.jeton_for_invitee,
        jeton_for_inviter: policy.jeton_for_inviter,
        max_invites_per_teacher: policy.max_invites_per_teacher,
      },
    };
  }

  async listRedemptions(
    inviterUserId: string,
    page: number,
    limit: number,
  ): Promise<{
    total: number;
    items: Array<{
      id: string;
      created_at: string;
      invitee_display: string | null;
      invitee_jeton: number;
      inviter_jeton: number;
    }>;
  }> {
    const code = await this.codeRepo.findOne({ where: { inviterUserId } });
    if (!code) {
      return { total: 0, items: [] };
    }
    const [rows, total] = await this.redemptionRepo.findAndCount({
      where: { inviteCodeId: code.id },
      relations: ['invitee'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      total,
      items: rows.map((x) => ({
        id: x.id,
        created_at: x.createdAt instanceof Date ? x.createdAt.toISOString() : String(x.createdAt),
        invitee_display: maskEmail(x.invitee?.email ?? null, x.invitee?.display_name ?? null),
        invitee_jeton: parseFloat(String(x.inviteeJeton)) || 0,
        inviter_jeton: parseFloat(String(x.inviterJeton)) || 0,
      })),
    };
  }

  /**
   * Yeni kayıt sonrası çağrılır. Davet kodu yoksa veya sistem kapalıysa no-op (kod yoksa).
   */
  async redeemAfterRegistration(inviteeUserId: string, rawInviteRaw: string | undefined | null): Promise<void> {
    const raw = rawInviteRaw?.trim();
    if (!raw) return;
    const policy = (await this.appConfig.getMarketPolicyConfig()).teacher_invite_jeton;
    if (!policy.enabled) {
      throw new BadRequestException({
        code: 'TEACHER_INVITE_DISABLED',
        message: 'Davetiye sistemi kapalı; davet kodu kullanılamaz.',
      });
    }
    const codeNorm = normalizeCode(raw);
    if (codeNorm.length < 4) {
      throw new BadRequestException({ code: 'INVITE_CODE_INVALID', message: 'Geçersiz davet kodu.' });
    }
    const invitee = await this.userRepo.findOne({ where: { id: inviteeUserId }, select: ['id', 'role'] });
    if (!invitee || invitee.role !== UserRole.teacher) {
      throw new BadRequestException({ code: 'INVALID_ROLE', message: 'Davet yalnızca öğretmen kaydında geçerlidir.' });
    }
    const codeRow = await this.codeRepo.findOne({ where: { code: codeNorm } });
    if (!codeRow) {
      throw new BadRequestException({ code: 'INVITE_CODE_INVALID', message: 'Geçersiz davet kodu.' });
    }
    if (codeRow.inviterUserId === inviteeUserId) {
      throw new BadRequestException({ code: 'INVITE_SELF', message: 'Kendi davet kodunuzu kullanamazsınız.' });
    }
    const inviter = await this.userRepo.findOne({ where: { id: codeRow.inviterUserId }, select: ['id', 'role'] });
    if (!inviter || inviter.role !== UserRole.teacher) {
      throw new BadRequestException({ code: 'INVITER_INVALID', message: 'Davet sahibi geçerli değil.' });
    }
    const used = await this.redemptionRepo.count({ where: { inviteeUserId } });
    if (used > 0) {
      throw new BadRequestException({ code: 'INVITE_ALREADY_USED', message: 'Bu hesap için davet zaten işlendi.' });
    }
    const max = policy.max_invites_per_teacher;
    if (max > 0) {
      const cnt = await this.redemptionRepo
        .createQueryBuilder('r')
        .innerJoin(TeacherInviteCode, 'c', 'c.id = r.invite_code_id')
        .where('c.inviter_user_id = :uid', { uid: codeRow.inviterUserId })
        .getCount();
      if (cnt >= max) {
        throw new BadRequestException({
          code: 'INVITE_QUOTA_EXCEEDED',
          message: 'Bu davet kodu için üst sınırına ulaşıldı.',
        });
      }
    }
    const jInv = policy.jeton_for_inviter;
    const jInvt = policy.jeton_for_invitee;
    const jInvS = toSqlAmount(jInv);
    const jInvtS = toSqlAmount(jInvt);
    if (jInvS === '0.000000' && jInvtS === '0.000000') {
      throw new BadRequestException({ code: 'INVITE_REWARD_ZERO', message: 'Davet ödülleri yapılandırılmamış.' });
    }
    await this.dataSource.transaction(async (em) => {
      const ins = em.create(TeacherInviteRedemption, {
        inviteCodeId: codeRow.id,
        inviteeUserId,
        inviteeJeton: jInvtS,
        inviterJeton: jInvS,
      });
      await em.save(TeacherInviteRedemption, ins);
      if (jInvtS !== '0.000000') {
        await em.query(
          `UPDATE users SET
            market_jeton_balance = COALESCE(market_jeton_balance, 0)::numeric + $1::numeric
          WHERE id = $2`,
          [jInvtS, inviteeUserId],
        );
        const led1 = em.create(MarketUserCreditLedger, {
          targetUserId: inviteeUserId,
          createdByUserId: codeRow.inviterUserId,
          jetonCredit: jInvtS,
          ekdersCredit: '0.000000',
          note: 'Davetiye ile kayıt bonusu (jeton)',
        });
        await em.save(MarketUserCreditLedger, led1);
      }
      if (jInvS !== '0.000000') {
        await em.query(
          `UPDATE users SET
            market_jeton_balance = COALESCE(market_jeton_balance, 0)::numeric + $1::numeric
          WHERE id = $2`,
          [jInvS, codeRow.inviterUserId],
        );
        const led2 = em.create(MarketUserCreditLedger, {
          targetUserId: codeRow.inviterUserId,
          createdByUserId: inviteeUserId,
          jetonCredit: jInvS,
          ekdersCredit: '0.000000',
          note: 'Davetiye bonusu: yeni öğretmen kaydı (jeton)',
        });
        await em.save(MarketUserCreditLedger, led2);
      }
    });
    void notifyInviteeBonus(this.notifications, inviteeUserId, jInvt).catch(() => {});
    void notifyInviterBonus(this.notifications, codeRow.inviterUserId, jInv).catch(() => {});
  }
}

function maskEmail(email: string | null, displayName: string | null): string | null {
  if (displayName?.trim()) return displayName.trim();
  if (!email?.trim()) return null;
  const [a, dom] = email.trim().split('@');
  if (!dom) return '***';
  const al = a.length <= 2 ? `${a[0] ?? ''}*` : `${a.slice(0, 2)}***`;
  return `${al}@${dom}`;
}

async function notifyInviteeBonus(
  notifications: NotificationsService,
  userId: string,
  jeton: number,
): Promise<void> {
  if (jeton <= 0) return;
  await notifications.createInboxEntry({
    user_id: userId,
    event_type: 'market.teacher_invite_invitee',
    entity_id: userId,
    target_screen: 'market',
    title: 'Davetiye bonusu',
    body: `Kayıt için ${jeton} jeton hesabınıza eklendi.`,
    metadata: { jeton },
  });
}

async function notifyInviterBonus(
  notifications: NotificationsService,
  userId: string,
  jeton: number,
): Promise<void> {
  if (jeton <= 0) return;
  await notifications.createInboxEntry({
    user_id: userId,
    event_type: 'market.teacher_invite_inviter',
    entity_id: userId,
    target_screen: 'market',
    title: 'Davetiye kazancı',
    body: `Davet ettiğiniz öğretmen kaydoldu; ${jeton} jeton eklendi.`,
    metadata: { jeton },
  });
}
