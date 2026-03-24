import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entitlement } from './entities/entitlement.entity';
import { UserRole } from '../types/enums';

/** Varsayılan evrak üretim kotası – yeni kullanıcı veya kayıt yoksa */
const DEFAULT_EVRAK_QUANTITY = 10;

/** Development’ta veya EVRAK_SKIP_TEACHER_QUOTA=1 iken öğretmen evrak kotası düşmez / 402 verilmez. */
function isTeacherEvrakQuotaSkipped(): boolean {
  const v = process.env.EVRAK_SKIP_TEACHER_QUOTA?.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return process.env.NODE_ENV !== 'production';
}

@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(Entitlement)
    private readonly repo: Repository<Entitlement>,
  ) {}

  /** Kullanıcının evrak_uretim miktarını getir; yoksa varsayılanla oluştur */
  async getEvrakQuantity(userId: string): Promise<number> {
    let ent = await this.repo.findOne({
      where: { userId, entitlementType: 'evrak_uretim' },
    });
    if (!ent) {
      ent = this.repo.create({
        userId,
        entitlementType: 'evrak_uretim',
        quantity: DEFAULT_EVRAK_QUANTITY,
      });
      await this.repo.save(ent);
    }
    if (ent.expiresAt && new Date() > ent.expiresAt) return 0;
    return Math.max(0, ent.quantity);
  }

  /**
   * Evrak üretim hakkını kontrol et ve 1 düş.
   * Kotası yoksa ENTITLEMENT_REQUIRED (402) fırlatır.
   * superadmin / moderator bypass (rol kontrolü caller'da).
   */
  async checkAndConsumeEvrak(userId: string): Promise<void> {
    if (isTeacherEvrakQuotaSkipped()) return;
    const qty = await this.getEvrakQuantity(userId);
    if (qty <= 0) {
      throw new HttpException(
        {
          code: 'ENTITLEMENT_REQUIRED',
          message: 'Evrak üretim kotanız bitti. Marketten hak satın alarak devam edebilirsiniz.',
          details: { entitlement_type: 'evrak_uretim' },
        },
        HttpStatus.PAYMENT_REQUIRED, // 402
      );
    }
    await this.repo.decrement(
      { userId, entitlementType: 'evrak_uretim' },
      'quantity',
      1,
    );
  }

  /** Tüm entitlement'ları döndür (frontend için) */
  async findAllForUser(userId: string): Promise<{ entitlementType: string; quantity: number; expiresAt: string | null }[]> {
    const list = await this.repo.find({
      where: { userId },
      order: { entitlementType: 'ASC' },
    });
    return list.map((e) => ({
      entitlementType: e.entitlementType,
      quantity: Math.max(0, e.quantity),
      expiresAt: e.expiresAt?.toISOString() ?? null,
    }));
  }

  /** Rol entitlement kontrolünden muaf mı? (superadmin, moderator evrak için) */
  static isEvrakExempt(role: UserRole): boolean {
    return role === UserRole.superadmin || role === UserRole.moderator;
  }
}
