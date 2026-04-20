import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { YillikPlanIcerik } from '../yillik-plan-icerik/entities/yillik-plan-icerik.entity';
import { DocumentTemplate } from '../document-templates/entities/document-template.entity';
import { BilsemPlanSubmission } from './entities/bilsem-plan-submission.entity';
import { MarketPlanCreatorRewardLedger } from './entities/market-plan-creator-reward-ledger.entity';
import { MarketWalletService } from '../market/market-wallet.service';
import { UserRole } from '../types/enums';
import { isBilsemSubjectCode } from './bilsem-puy-plan-constants';

@Injectable()
export class BilsemPlanCreatorRewardService {
  private readonly logger = new Logger(BilsemPlanCreatorRewardService.name);

  constructor(
    @InjectRepository(YillikPlanIcerik)
    private readonly yillikRepo: Repository<YillikPlanIcerik>,
    @InjectRepository(BilsemPlanSubmission)
    private readonly submissionRepo: Repository<BilsemPlanSubmission>,
    @InjectRepository(MarketPlanCreatorRewardLedger)
    private readonly ledgerRepo: Repository<MarketPlanCreatorRewardLedger>,
    private readonly wallet: MarketWalletService,
  ) {}

  async tryRewardAfterYillikPlanGeneration(params: {
    consumerUserId: string;
    documentGenerationId: string;
    template: DocumentTemplate;
    formData: Record<string, string | number>;
  }): Promise<void> {
    const { consumerUserId, documentGenerationId, template, formData } = params;
    if (template.type !== 'yillik_plan') return;

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '') || '';
    let subjectCode =
      template.subjectCode?.trim() ||
      str(formData.ders_kodu) ||
      str((formData as Record<string, unknown>).dersKodu) ||
      str((formData as Record<string, unknown>).subject_code) ||
      '';
    const isBilsemPlan =
      template.curriculumModel?.trim() === 'bilsem' || isBilsemSubjectCode(subjectCode);
    if (!isBilsemPlan) return;

    if (!isBilsemSubjectCode(subjectCode)) {
      subjectCode =
        str(formData.ders_kodu) ||
        str((formData as Record<string, unknown>).dersKodu) ||
        str((formData as Record<string, unknown>).subject_code) ||
        '';
    }
    if (!subjectCode) return;

    const academicYear =
      str(formData.ogretim_yili) ||
      str(formData.academic_year) ||
      str(template.academicYear) ||
      '';
    if (!academicYear) return;

    const anaGrup = str(formData.ana_grup);
    if (!anaGrup) return;
    const altGrupRaw = str(formData.alt_grup);
    const altGrup = altGrupRaw || null;

    const qb = this.yillikRepo
      .createQueryBuilder('yp')
      .select('yp.submissionId', 'sid')
      .where('yp.subjectCode = :sc', { sc: subjectCode })
      .andWhere('yp.academicYear = :ay', { ay: academicYear })
      .andWhere('yp.curriculumModel = :cm', { cm: 'bilsem' })
      .andWhere('yp.anaGrup = :ana', { ana: anaGrup })
      .andWhere('yp.submissionId IS NOT NULL');
    if (altGrup) {
      qb.andWhere('yp.altGrup = :alt', { alt: altGrup });
    } else {
      qb.andWhere('(yp.altGrup IS NULL OR yp.altGrup = :empty)', { empty: '' });
    }
    const raw = await qb.distinct(true).getRawMany();
    const ids = [
      ...new Set(
        raw
          .map((r: { sid?: string | null }) => r.sid)
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    ];
    if (ids.length !== 1) return;
    const submissionId = ids[0]!;

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, status: 'published' },
    });
    if (!submission) return;
    if (submission.authorUserId === consumerUserId) return;

    const reward = Number.parseFloat(String(submission.rewardJetonPerGeneration ?? '0'));
    if (!Number.isFinite(reward) || reward <= 0) return;

    const idempotencyKey = `bilsem_plan_gen:${documentGenerationId}`;
    const ledgerRow = this.ledgerRepo.create({
      idempotencyKey,
      creatorUserId: submission.authorUserId,
      consumerUserId,
      submissionId: submission.id,
      documentGenerationId,
      jetonCredit: reward.toFixed(6),
    });
    try {
      await this.ledgerRepo.save(ledgerRow);
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        const c = (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
        if (c === '23505') return;
      }
      this.logger.warn(`Plan ödülü ledger atlandı: ${e instanceof Error ? e.message : e}`);
      return;
    }

    try {
      await this.wallet.applyCredit({
        userId: submission.authorUserId,
        schoolId: null,
        role: UserRole.teacher,
        creditAccount: 'user',
        currencyKind: 'jeton',
        amount: reward,
      });
    } catch (e) {
      this.logger.warn(`Plan ödülü bakiyeye eklenemedi: ${e instanceof Error ? e.message : e}`);
    }
  }
}
