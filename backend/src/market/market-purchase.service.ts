import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { createHash } from 'crypto';
import { AppConfigService } from '../app-config/app-config.service';
import { UserRole } from '../types/enums';
import { MarketPurchaseLedger } from './entities/market-purchase-ledger.entity';
import { MarketWalletService } from './market-wallet.service';
import { verifyAndroidProductPurchase, getDefaultAndroidPackageName } from './google-play-verify';
import { verifyIosReceipt, getAppleSharedSecret } from './apple-iap-verify';
import { resolveIapCreditFromPolicy } from './market-iap-resolve';
import type { VerifyAndroidPurchaseDto } from './dto/verify-android-purchase.dto';
import type { VerifyIosPurchaseDto } from './dto/verify-ios-purchase.dto';

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function hashReceiptBase64(b64: string): string {
  return createHash('sha256').update(b64, 'utf8').digest('hex');
}

@Injectable()
export class MarketPurchaseService {
  constructor(
    @InjectRepository(MarketPurchaseLedger)
    private readonly ledgerRepo: Repository<MarketPurchaseLedger>,
    private readonly appConfig: AppConfigService,
    private readonly wallet: MarketWalletService,
  ) {}

  async verifyAndroidPurchase(
    userId: string,
    schoolId: string | null,
    role: UserRole,
    dto: VerifyAndroidPurchaseDto,
  ): Promise<{ ledger: MarketPurchaseLedger; duplicate?: boolean }> {
    this.assertCreditAccount(dto.credit_account, role, schoolId);

    const tokenHash = hashToken(dto.purchase_token);
    const dup = await this.ledgerRepo.findOne({
      where: {
        userId,
        purchaseTokenHash: tokenHash,
        status: In(['verified', 'duplicate']),
      },
    });
    if (dup) {
      const mark = this.ledgerRepo.create({
        userId,
        schoolId,
        platform: 'android',
        productKind: dto.product_kind ?? 'unknown',
        currencyKind: dto.currency_kind ?? 'unknown',
        productId: dto.product_id,
        status: 'duplicate',
        purchaseTokenHash: tokenHash,
        verificationNote: 'Aynı purchase_token daha önce işlendi.',
        providerDetail: { duplicate_of_ledger_id: dup.id },
        creditsApplied: false,
      });
      await this.ledgerRepo.save(mark);
      return { ledger: mark, duplicate: true };
    }

    const row = this.ledgerRepo.create({
      userId,
      schoolId,
      platform: 'android',
      productKind: dto.product_kind ?? 'unknown',
      currencyKind: dto.currency_kind ?? 'unknown',
      productId: dto.product_id,
      status: 'pending',
      purchaseTokenHash: tokenHash,
      creditsApplied: false,
    });
    await this.ledgerRepo.save(row);

    const pkg = (dto.package_name?.trim() || getDefaultAndroidPackageName()) ?? null;
    if (!pkg) {
      row.status = 'skipped_no_credentials';
      row.verificationNote = 'Google Play: package_name veya GOOGLE_PLAY_PACKAGE_NAME tanımlı değil.';
      await this.ledgerRepo.save(row);
      return { ledger: row };
    }

    const creds = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
    if (!creds) {
      row.status = 'skipped_no_credentials';
      row.verificationNote = 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON tanımlı değil; sunucu doğrulaması atlandı.';
      await this.ledgerRepo.save(row);
      return { ledger: row };
    }

    const result = await verifyAndroidProductPurchase({
      packageName: pkg,
      productId: dto.product_id,
      purchaseToken: dto.purchase_token,
    });
    if (result.ok) {
      row.status = 'verified';
      row.verificationNote = 'Google Play: doğrulama başarılı.';
      row.providerDetail = { google: result.body ?? null };
    } else {
      row.status = 'rejected';
      row.verificationNote = result.error ?? 'Google Play reddi';
      row.providerDetail = { google: { httpStatus: result.httpStatus, body: result.body } };
    }
    await this.ledgerRepo.save(row);

    if (row.status === 'verified') {
      await this.tryApplyCredit({ ledger: row, userId, schoolId, role, platform: 'android', dto });
    }
    return { ledger: row };
  }

  async verifyIosPurchase(
    userId: string,
    schoolId: string | null,
    role: UserRole,
    dto: VerifyIosPurchaseDto,
  ): Promise<{ ledger: MarketPurchaseLedger; duplicate?: boolean }> {
    this.assertCreditAccount(dto.credit_account, role, schoolId);

    const tokenHash = hashReceiptBase64(dto.receipt_data_base64);
    const dup = await this.ledgerRepo.findOne({
      where: {
        userId,
        purchaseTokenHash: tokenHash,
        status: In(['verified', 'duplicate']),
      },
    });
    if (dup) {
      const mark = this.ledgerRepo.create({
        userId,
        schoolId,
        platform: 'ios',
        productKind: dto.product_kind ?? 'unknown',
        currencyKind: dto.currency_kind ?? 'unknown',
        productId: dto.expected_product_id ?? 'unknown',
        status: 'duplicate',
        purchaseTokenHash: tokenHash,
        verificationNote: 'Aynı receipt daha önce işlendi.',
        providerDetail: { duplicate_of_ledger_id: dup.id },
        creditsApplied: false,
      });
      await this.ledgerRepo.save(mark);
      return { ledger: mark, duplicate: true };
    }

    const row = this.ledgerRepo.create({
      userId,
      schoolId,
      platform: 'ios',
      productKind: dto.product_kind ?? 'unknown',
      currencyKind: dto.currency_kind ?? 'unknown',
      productId: dto.expected_product_id ?? 'unknown',
      status: 'pending',
      purchaseTokenHash: tokenHash,
      creditsApplied: false,
    });
    await this.ledgerRepo.save(row);

    const secret = getAppleSharedSecret();
    if (!secret) {
      row.status = 'skipped_no_credentials';
      row.verificationNote = 'APPLE_SHARED_SECRET tanımlı değil; sunucu doğrulaması atlandı.';
      await this.ledgerRepo.save(row);
      return { ledger: row };
    }

    const result = await verifyIosReceipt({
      receiptDataBase64: dto.receipt_data_base64,
      sharedSecret: secret,
    });

    if (!result.ok) {
      row.status = 'rejected';
      row.verificationNote = result.error ?? `Apple status ${result.status}`;
      row.providerDetail = { apple: result };
      await this.ledgerRepo.save(row);
      return { ledger: row };
    }

    const expected = dto.expected_product_id?.trim();
    if (expected && result.productIds?.length && !result.productIds.includes(expected)) {
      row.status = 'rejected';
      row.verificationNote = `Beklenen ürün ${expected} makbuzda yok.`;
      row.providerDetail = { apple: result };
      await this.ledgerRepo.save(row);
      return { ledger: row };
    }

    row.status = 'verified';
    row.verificationNote = 'Apple verifyReceipt: doğrulama başarılı.';
    row.providerDetail = { apple: result };
    const exp = dto.expected_product_id?.trim();
    if (exp) row.productId = exp;
    else if (productIdFromApple(result)) row.productId = productIdFromApple(result)!;
    await this.ledgerRepo.save(row);

    await this.tryApplyCredit({ ledger: row, userId, schoolId, role, platform: 'ios', dto });
    return { ledger: row };
  }

  private assertCreditAccount(
    creditAccount: 'user' | 'school' | undefined,
    role: UserRole,
    schoolId: string | null,
  ): void {
    if (creditAccount === 'school') {
      if (role !== UserRole.school_admin) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul cüzdanı yalnızca okul yöneticisi içindir.' });
      }
      if (!schoolId) {
        throw new BadRequestException({ code: 'BAD_INPUT', message: 'Okul cüzdanı için okul bilgisi gerekli.' });
      }
    }
  }

  private async tryApplyCredit(params: {
    ledger: MarketPurchaseLedger;
    userId: string;
    schoolId: string | null;
    role: UserRole;
    platform: 'android' | 'ios';
    dto: VerifyAndroidPurchaseDto | VerifyIosPurchaseDto;
  }): Promise<void> {
    const { ledger, userId, schoolId, role, platform, dto } = params;
    const policy = await this.appConfig.getMarketPolicyConfig();
    const hint =
      dto.currency_kind === 'jeton' || dto.currency_kind === 'ekders' ? dto.currency_kind : undefined;
    const resolved = resolveIapCreditFromPolicy(policy, platform, ledger.productId, hint);
    if (!resolved || resolved.amount <= 0) {
      ledger.verificationNote = `${ledger.verificationNote ?? ''} | Ürün market IAP listesinde yok veya miktar 0; bakiye eklenmedi.`.trim();
      await this.ledgerRepo.save(ledger);
      return;
    }

    const creditAccount = dto.credit_account === 'school' ? 'school' : 'user';
    try {
      await this.wallet.applyCredit({
        userId,
        schoolId,
        role,
        creditAccount,
        currencyKind: resolved.currencyKind,
        amount: resolved.amount,
      });
      ledger.creditsApplied = true;
      ledger.amountCredited = String(resolved.amount);
      ledger.creditTarget = creditAccount;
      await this.ledgerRepo.save(ledger);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bakiye eklenemedi';
      ledger.verificationNote = `${ledger.verificationNote ?? ''} | ${msg}`.trim();
      await this.ledgerRepo.save(ledger);
    }
  }

  async listLedger(params: { page: number; limit: number }): Promise<{
    total: number;
    items: MarketPurchaseLedger[];
  }> {
    const limit = Math.min(100, Math.max(1, params.limit));
    const page = Math.max(1, params.page);
    const [items, total] = await this.ledgerRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { total, items };
  }

  async listMine(userId: string, params: { page: number; limit: number }): Promise<{
    total: number;
    items: MarketPurchaseLedger[];
  }> {
    const limit = Math.min(100, Math.max(1, params.limit));
    const page = Math.max(1, params.page);
    const [items, total] = await this.ledgerRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { total, items };
  }

  async listSchoolLedger(schoolId: string, params: { page: number; limit: number }): Promise<{
    total: number;
    items: MarketPurchaseLedger[];
  }> {
    const limit = Math.min(100, Math.max(1, params.limit));
    const page = Math.max(1, params.page);
    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .where('l.schoolId = :sid', { sid: schoolId })
      .andWhere('(l.creditTarget = :ct OR l.creditTarget IS NULL)', { ct: 'school' })
      .orderBy('l.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);
    const [items, total] = await qb.getManyAndCount();
    return { total, items };
  }

  async anomalies(params: { hours: number; minCount: number }): Promise<
    { user_id: string; transaction_count: string }[]
  > {
    const hours = Math.min(168, Math.max(1, params.hours));
    const minCount = Math.min(1000, Math.max(2, params.minCount));
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const rows = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('l.userId', 'user_id')
      .addSelect('COUNT(*)', 'transaction_count')
      .where('l.createdAt >= :since', { since })
      .groupBy('l.userId')
      .having('COUNT(*) > :min', { min: minCount })
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ user_id: string; transaction_count: string }>();
    return rows;
  }

  /** Superadmin: IAP ile bakiyeye yansıyan krediler — takvim ayı / yıl (verified + credits_applied). */
  async getAdminPurchaseCreditsForRange(start: Date, end: Date): Promise<{
    user: { jeton: number; ekders: number };
    school: { jeton: number; ekders: number };
  }> {
    const rows = await this.ledgerRepo.query(
      `SELECT
        COALESCE(SUM(CASE WHEN currency_kind = 'jeton' AND (credit_target = 'user' OR credit_target IS NULL) THEN amount_credited::numeric ELSE 0 END), 0)::text AS ju,
        COALESCE(SUM(CASE WHEN currency_kind = 'jeton' AND credit_target = 'school' THEN amount_credited::numeric ELSE 0 END), 0)::text AS js,
        COALESCE(SUM(CASE WHEN currency_kind = 'ekders' AND (credit_target = 'user' OR credit_target IS NULL) THEN amount_credited::numeric ELSE 0 END), 0)::text AS eu,
        COALESCE(SUM(CASE WHEN currency_kind = 'ekders' AND credit_target = 'school' THEN amount_credited::numeric ELSE 0 END), 0)::text AS es
      FROM market_purchase_ledger
      WHERE credits_applied = true
        AND created_at >= $1 AND created_at < $2`,
      [start, end],
    );
    const row = rows?.[0];
    const n = (v: unknown) => parseFloat(String(v ?? '0')) || 0;
    return {
      user: { jeton: n(row?.ju), ekders: n(row?.eu) },
      school: { jeton: n(row?.js), ekders: n(row?.es) },
    };
  }
}

function productIdFromApple(r: { productIds?: string[] }): string | null {
  const p = r.productIds?.[0];
  return p ?? null;
}
