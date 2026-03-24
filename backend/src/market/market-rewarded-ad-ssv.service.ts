import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createPublicKey, verify } from 'crypto';
import * as https from 'https';
import { AppConfigService } from '../app-config/app-config.service';
import { MarketRewardedAdLedger } from './entities/market-rewarded-ad-ledger.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';

const VERIFIER_KEYS_URL = 'https://gstatic.com/admob/reward/verifier-keys.json';
const SIGNATURE_PARAM = 'signature=';
const KEY_ID_PARAM = '&key_id=';

function padBase64(s: string): string {
  const pad = s.length % 4;
  if (pad) return s + '='.repeat(4 - pad);
  return s;
}

function toSqlJeton(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0.000000';
  return (Math.round(n * 1e6) / 1e6).toFixed(6);
}

type VerifierKeyRecord = { keyId: number; base64: string };

@Injectable()
export class MarketRewardedAdSsvService {
  private readonly logger = new Logger(MarketRewardedAdSsvService.name);
  private keysCache: Map<number, Buffer> | null = null;
  private keysFetchedAt = 0;
  private readonly keysTtlMs = 60 * 60 * 1000;

  constructor(
    private readonly appConfig: AppConfigService,
    @InjectRepository(MarketRewardedAdLedger)
    private readonly ledgerRepo: Repository<MarketRewardedAdLedger>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * AdMob SSV callback — query string (URL ? sonrası, ham UTF-8).
   * Google imza doğrulaması: signature ve key_id son parametreler.
   */
  async handleSsvQueryString(queryString: string): Promise<{ status: 'ok' | 'ignored' | 'error'; detail?: string }> {
    if (!queryString?.trim()) {
      return { status: 'ignored', detail: 'empty' };
    }
    let policy;
    try {
      policy = (await this.appConfig.getMarketPolicyConfig()).rewarded_ad_jeton;
    } catch (e) {
      this.logger.warn(`policy: ${e}`);
      return { status: 'error', detail: 'policy' };
    }
    if (!policy.enabled) {
      return { status: 'ignored', detail: 'disabled' };
    }

    let dataToVerify: Buffer;
    let sigB64: string;
    let keyId: number;
    try {
      const parsed = this.parseSignatureParts(queryString);
      dataToVerify = parsed.dataToVerify;
      sigB64 = parsed.sigB64;
      keyId = parsed.keyId;
    } catch (e) {
      this.logger.warn(`parse: ${e}`);
      return { status: 'error', detail: 'parse' };
    }

    const pubDer = await this.getVerifierKeyDer(keyId);
    if (!pubDer) {
      return { status: 'error', detail: 'key' };
    }

    let sigBuf: Buffer;
    try {
      sigBuf = Buffer.from(padBase64(sigB64.replace(/-/g, '+').replace(/_/g, '/')), 'base64');
    } catch {
      return { status: 'error', detail: 'sig_decode' };
    }

    let ok = false;
    try {
      const key = createPublicKey({ key: pubDer, format: 'der', type: 'spki' });
      ok = verify(null, dataToVerify, key, sigBuf);
    } catch (e) {
      this.logger.warn(`verify: ${e}`);
      return { status: 'error', detail: 'verify' };
    }
    if (!ok) {
      return { status: 'error', detail: 'sig' };
    }

    const params = this.parseQueryKeyValues(queryString);
    const transactionId = params.transaction_id?.trim();
    const userId = params.user_id?.trim();
    const adUnit = params.ad_unit?.trim() ?? '';

    if (!transactionId || !userId) {
      return { status: 'ignored', detail: 'missing_ids' };
    }

    if (policy.allowed_ad_unit_ids.length > 0) {
      const allow = new Set(policy.allowed_ad_unit_ids);
      if (!allow.has(adUnit)) {
        return { status: 'ignored', detail: 'ad_unit' };
      }
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'role'],
    });
    if (!user || user.role !== UserRole.teacher) {
      return { status: 'ignored', detail: 'user' };
    }

    const jeton = policy.jeton_per_reward;
    if (!Number.isFinite(jeton) || jeton <= 0) {
      return { status: 'ignored', detail: 'amount' };
    }

    const exists = await this.ledgerRepo.exist({ where: { transactionId } });
    if (exists) {
      return { status: 'ignored', detail: 'duplicate' };
    }

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayCount = await this.ledgerRepo
      .createQueryBuilder('l')
      .where('l.userId = :uid', { uid: userId })
      .andWhere('l.createdAt >= :start', { start: dayStart })
      .getCount();
    if (todayCount >= policy.max_rewards_per_day) {
      return { status: 'ignored', detail: 'daily_cap' };
    }

    if (policy.cooldown_seconds > 0) {
      const last = await this.ledgerRepo.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      if (last) {
        const secs = (now.getTime() - last.createdAt.getTime()) / 1000;
        if (secs < policy.cooldown_seconds) {
          return { status: 'ignored', detail: 'cooldown' };
        }
      }
    }

    const jSql = toSqlJeton(jeton);
    try {
      await this.dataSource.transaction(async (em) => {
        const ins = em.create(MarketRewardedAdLedger, {
          userId,
          transactionId,
          jetonCredit: jSql,
          adUnitKey: adUnit || null,
        });
        await em.save(MarketRewardedAdLedger, ins);
        await em.query(
          `UPDATE users SET market_jeton_balance = COALESCE(market_jeton_balance, 0)::numeric + $1::numeric WHERE id = $2`,
          [jSql, userId],
        );
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate') || msg.includes('unique')) {
        return { status: 'ignored', detail: 'race' };
      }
      this.logger.error(`credit: ${msg}`);
      return { status: 'error', detail: 'db' };
    }

    return { status: 'ok' };
  }

  private parseSignatureParts(queryString: string): { dataToVerify: Buffer; sigB64: string; keyId: number } {
    const i = queryString.indexOf(SIGNATURE_PARAM);
    if (i <= 0) throw new Error('signature');
    const dataToVerify = queryString.substring(0, i - 1);
    const sigAndKey = queryString.substring(i);
    const j = sigAndKey.indexOf(KEY_ID_PARAM);
    if (j === -1) throw new Error('key_id');
    const sigB64 = sigAndKey.substring(SIGNATURE_PARAM.length, j);
    const keyIdStr = sigAndKey.substring(j + KEY_ID_PARAM.length);
    const keyId = parseInt(keyIdStr, 10);
    if (Number.isNaN(keyId)) throw new Error('key_id_nan');
    return { dataToVerify: Buffer.from(dataToVerify, 'utf8'), sigB64, keyId };
  }

  private parseQueryKeyValues(queryString: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of queryString.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const k = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' '));
      const v = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
      out[k] = v;
    }
    return out;
  }

  private async getVerifierKeyDer(keyId: number): Promise<Buffer | null> {
    await this.refreshKeysIfNeeded();
    return this.keysCache?.get(keyId) ?? null;
  }

  private async refreshKeysIfNeeded(): Promise<void> {
    const now = Date.now();
    if (this.keysCache && now - this.keysFetchedAt < this.keysTtlMs) return;

    const json = await this.fetchText(VERIFIER_KEYS_URL);
    let parsed: { keys?: VerifierKeyRecord[] };
    try {
      parsed = JSON.parse(json) as { keys?: VerifierKeyRecord[] };
    } catch {
      this.logger.error('verifier-keys json');
      return;
    }
    const m = new Map<number, Buffer>();
    for (const k of parsed.keys ?? []) {
      if (k?.keyId != null && k.base64) {
        try {
          m.set(k.keyId, Buffer.from(k.base64, 'base64'));
        } catch {
          /* skip */
        }
      }
    }
    if (m.size === 0) {
      this.logger.error('verifier-keys empty');
      return;
    }
    this.keysCache = m;
    this.keysFetchedAt = now;
  }

  private fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        })
        .on('error', reject);
    });
  }

  async listLedgerAdmin(page: number, limit: number): Promise<{ total: number; items: MarketRewardedAdLedger[] }> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const [items, total] = await this.ledgerRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
    return { total, items };
  }

  /** Öğretmen: kendi ödüllü reklam jeton geçmişi */
  async listLedgerForTeacher(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ total: number; items: MarketRewardedAdLedger[] }> {
    const p = Math.max(1, page);
    const l = Math.min(50, Math.max(1, limit));
    const [items, total] = await this.ledgerRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
    return { total, items };
  }
}
