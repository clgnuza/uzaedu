import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthVerificationCode, AuthOtpPurpose } from './entities/auth-verification-code.entity';

const MAX_ATTEMPTS = 8;
const DEFAULT_TTL_MIN = 12;

@Injectable()
export class AuthOtpService {
  private readonly logger = new Logger(AuthOtpService.name);

  constructor(
    @InjectRepository(AuthVerificationCode)
    private readonly repo: Repository<AuthVerificationCode>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** 6 haneli kod üretir, kaydeder; düz metin kodu döner (yalnızca e-posta gönderiminde kullanılır). */
  async issue(emailRaw: string, purpose: AuthOtpPurpose, meta?: Record<string, unknown> | null): Promise<string> {
    const email = this.normalizeEmail(emailRaw);
    await this.repo.delete({ email, purpose, consumedAt: IsNull() });
    const code = String(randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MIN * 60 * 1000);
    await this.repo.save(
      this.repo.create({
        email,
        purpose,
        codeHash,
        expiresAt,
        consumedAt: null,
        attempts: 0,
        meta: meta ?? null,
      }),
    );
    if (process.env.NODE_ENV === 'local' || process.env.ALLOW_DEMO_LOGIN === 'true') {
      this.logger.log(`OTP ${purpose} ${email}: ${code}`);
    }
    return code;
  }

  async verifyAndConsume(emailRaw: string, purpose: AuthOtpPurpose, plainCode: string): Promise<boolean> {
    const email = this.normalizeEmail(emailRaw);
    const code = plainCode.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException({ code: 'INVALID_CODE', message: 'Doğrulama kodu 6 haneli olmalıdır.' });
    }
    const row = await this.repo.findOne({
      where: { email, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_CODE',
        message: 'Kod geçersiz veya süresi dolmuş. Yeni kod isteyin.',
      });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException({
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Çok fazla hatalı deneme. Yeni kod isteyin.',
      });
    }
    const ok = await bcrypt.compare(code, row.codeHash);
    if (!ok) {
      row.attempts += 1;
      await this.repo.save(row);
      throw new BadRequestException({ code: 'INVALID_CODE', message: 'Kod hatalı.' });
    }
    row.consumedAt = new Date();
    await this.repo.save(row);
    return true;
  }

  /** Süresi dolmuş satırları temizler (isteğe bağlı bakım). */
  async purgeExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
    await this.repo.delete({ expiresAt: LessThan(cutoff) });
  }
}
