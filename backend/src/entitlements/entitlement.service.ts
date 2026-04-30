import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entitlement } from './entities/entitlement.entity';
import { UserRole } from '../types/enums';

export const ENTITLEMENT_EVRAK_URETIM = 'evrak_uretim';
/** Yıllık plan (MEB/Bilsem) Word/Excel üretimi — diğer evrak şablonlarından ayrı kota */
export const ENTITLEMENT_YILLIK_PLAN_URETIM = 'yillik_plan_uretim';

const DEFAULT_EVRAK_QUANTITY = 10;
const DEFAULT_YILLIK_PLAN_QUANTITY = 10;

/** EVRAK_SKIP_TEACHER_QUOTA=1 iken öğretmen evrak kotası düşmez / 402 verilmez. */
function isTeacherEvrakQuotaSkipped(): boolean {
  const v = process.env.EVRAK_SKIP_TEACHER_QUOTA?.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  return false;
}

function defaultQuantityFor(entitlementType: string): number {
  return entitlementType === ENTITLEMENT_YILLIK_PLAN_URETIM ? DEFAULT_YILLIK_PLAN_QUANTITY : DEFAULT_EVRAK_QUANTITY;
}

@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(Entitlement)
    private readonly repo: Repository<Entitlement>,
  ) {}

  private async loadOrCreateEntitlement(userId: string, entitlementType: string): Promise<Entitlement> {
    let ent = await this.repo.findOne({
      where: { userId, entitlementType },
    });
    if (!ent) {
      ent = this.repo.create({
        userId,
        entitlementType,
        quantity: defaultQuantityFor(entitlementType),
      });
      await this.repo.save(ent);
    }
    return ent;
  }

  /** İlgili entitlement miktarı; kayıt yoksa varsayılanla oluşturulur */
  async getQuantity(userId: string, entitlementType: string): Promise<number> {
    const ent = await this.loadOrCreateEntitlement(userId, entitlementType);
    if (ent.expiresAt && new Date() > ent.expiresAt) return 0;
    return Math.max(0, ent.quantity);
  }

  /** Kullanıcının evrak_uretim miktarını getir; yoksa varsayılanla oluştur */
  async getEvrakQuantity(userId: string): Promise<number> {
    return this.getQuantity(userId, ENTITLEMENT_EVRAK_URETIM);
  }

  async getYillikPlanUretimQuantity(userId: string): Promise<number> {
    return this.getQuantity(userId, ENTITLEMENT_YILLIK_PLAN_URETIM);
  }

  /**
   * Evrak üretim hakkını kontrol et ve 1 düş (yıllık plan dışı şablonlar).
   * Kotası yoksa ENTITLEMENT_REQUIRED (402) fırlatır.
   */
  async checkAndConsumeEvrak(userId: string): Promise<void> {
    if (isTeacherEvrakQuotaSkipped()) return;
    const qty = await this.getEvrakQuantity(userId);
    if (qty <= 0) {
      throw new HttpException(
        {
          code: 'ENTITLEMENT_REQUIRED',
          message: 'Evrak üretim kotanız bitti. Marketten hak satın alarak devam edebilirsiniz.',
          details: { entitlement_type: ENTITLEMENT_EVRAK_URETIM },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    await this.repo.decrement({ userId, entitlementType: ENTITLEMENT_EVRAK_URETIM }, 'quantity', 1);
  }

  /**
   * Yıllık plan üretim hakkını kontrol et ve 1 düş.
   * Kotası yoksa ENTITLEMENT_REQUIRED (402) fırlatır.
   */
  async checkAndConsumeYillikPlanUretim(userId: string): Promise<void> {
    if (isTeacherEvrakQuotaSkipped()) return;
    const qty = await this.getYillikPlanUretimQuantity(userId);
    if (qty <= 0) {
      throw new HttpException(
        {
          code: 'ENTITLEMENT_REQUIRED',
          message:
            'Yıllık plan üretim kotanız bitti. Marketten plan üretim hakkı veya evrak paketi satın alarak devam edebilirsiniz.',
          details: { entitlement_type: ENTITLEMENT_YILLIK_PLAN_URETIM },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    await this.repo.decrement({ userId, entitlementType: ENTITLEMENT_YILLIK_PLAN_URETIM }, 'quantity', 1);
  }

  /**
   * Süperadmin / otomasyon: hak ekle (market webhook vb.).
   * Kayıt yoksa varsayılan kotayla oluşturulup üzerine eklenir.
   */
  async addEntitlementQuantity(userId: string, entitlementType: string, delta: number): Promise<void> {
    const d = Math.floor(delta);
    if (!Number.isFinite(d) || d <= 0) return;
    await this.loadOrCreateEntitlement(userId, entitlementType);
    await this.repo.increment({ userId, entitlementType }, 'quantity', d);
  }

  /** Tüm entitlement'ları döndür (frontend için) */
  async findAllForUser(userId: string): Promise<{ entitlementType: string; quantity: number; expiresAt: string | null }[]> {
    await this.getEvrakQuantity(userId);
    await this.getYillikPlanUretimQuantity(userId);
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
