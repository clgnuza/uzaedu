import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YillikPlanIcerik } from '../yillik-plan-icerik/entities/yillik-plan-icerik.entity';
import { BilsemPlanSubmission } from './entities/bilsem-plan-submission.entity';
import { BilsemPlanSubmissionLike } from './entities/bilsem-plan-submission-like.entity';
import { BilsemPlanSubmissionComment } from './entities/bilsem-plan-submission-comment.entity';
import { User } from '../users/entities/user.entity';

export type BilsemPlanSourceInfoDto = {
  has_community_source: boolean;
  submission_id: string | null;
  author_label: string | null;
  like_count: number;
  user_liked: boolean;
  comments: { id: string; body: string; author_label: string; created_at: string }[];
};

@Injectable()
export class BilsemPlanEngagementService {
  constructor(
    @InjectRepository(YillikPlanIcerik)
    private readonly yillikRepo: Repository<YillikPlanIcerik>,
    @InjectRepository(BilsemPlanSubmission)
    private readonly submissionRepo: Repository<BilsemPlanSubmission>,
    @InjectRepository(BilsemPlanSubmissionLike)
    private readonly likeRepo: Repository<BilsemPlanSubmissionLike>,
    @InjectRepository(BilsemPlanSubmissionComment)
    private readonly commentRepo: Repository<BilsemPlanSubmissionComment>,
  ) {}

  private static authorLabel(u: User | null | undefined): string {
    if (!u) return 'Katılımcı';
    const d = u.display_name?.trim();
    if (d) return d;
    return u.email?.trim() || 'Katılımcı';
  }

  async resolvePublishedSubmissionId(
    subjectCode: string,
    anaGrup: string,
    academicYear: string,
    altGrup: string | null,
  ): Promise<string | null> {
    const sc = subjectCode?.trim();
    const ana = anaGrup?.trim();
    const ay = academicYear?.trim();
    if (!sc || !ana || !ay) return null;
    const qb = this.yillikRepo
      .createQueryBuilder('yp')
      .select('yp.submissionId', 'sid')
      .where('yp.subjectCode = :sc', { sc })
      .andWhere('yp.academicYear = :y', { y: ay })
      .andWhere('yp.curriculumModel = :cm', { cm: 'bilsem' })
      .andWhere('yp.anaGrup = :ana', { ana })
      .andWhere('yp.submissionId IS NOT NULL');
    const alt = altGrup?.trim();
    if (alt) {
      qb.andWhere('yp.altGrup = :alt', { alt });
    } else {
      qb.andWhere('(yp.altGrup IS NULL OR yp.altGrup = :empty)', { empty: '' });
    }
    const r = await qb.orderBy('yp.weekOrder', 'ASC').getRawOne<{ sid?: string | null }>();
    const sid = r?.sid;
    if (typeof sid !== 'string' || !sid) return null;
    const sub = await this.submissionRepo.findOne({ where: { id: sid, status: 'published' } });
    return sub ? sid : null;
  }

  /** Word / önizleme: tek satırlık atıf metni. */
  async getAttributionLine(
    subjectCode: string,
    anaGrup: string,
    academicYear: string,
    altGrup: string | null,
  ): Promise<string | null> {
    const id = await this.resolvePublishedSubmissionId(subjectCode, anaGrup, academicYear, altGrup);
    if (!id) return null;
    const s = await this.submissionRepo.findOne({ where: { id }, relations: ['author'] });
    if (!s || s.status !== 'published') return null;
    return null;
  }

  async getSourceInfo(
    subjectCode: string,
    anaGrup: string,
    academicYear: string,
    altGrup: string | null,
    viewerUserId: string,
  ): Promise<BilsemPlanSourceInfoDto> {
    const sid = await this.resolvePublishedSubmissionId(subjectCode, anaGrup, academicYear, altGrup);
    if (!sid) {
      return {
        has_community_source: false,
        submission_id: null,
        author_label: null,
        like_count: 0,
        user_liked: false,
        comments: [],
      };
    }
    return this.getSourceInfoBySubmissionId(sid, viewerUserId);
  }

  async getSourceInfoBySubmissionId(
    submissionId: string,
    viewerUserId: string,
  ): Promise<BilsemPlanSourceInfoDto> {
    const s = await this.submissionRepo.findOne({
      where: { id: submissionId, status: 'published' },
      relations: ['author'],
    });
    if (!s) {
      return {
        has_community_source: false,
        submission_id: null,
        author_label: null,
        like_count: 0,
        user_liked: false,
        comments: [],
      };
    }
    const [likeCount, userLiked, commentRows] = await Promise.all([
      this.likeRepo.count({ where: { submissionId: s.id } }),
      this.likeRepo.findOne({ where: { submissionId: s.id, userId: viewerUserId } }),
      this.commentRepo.find({
        where: { submissionId: s.id },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 40,
      }),
    ]);
    return {
      has_community_source: true,
      submission_id: s.id,
      author_label: BilsemPlanEngagementService.authorLabel(s.author as User),
      like_count: likeCount,
      user_liked: !!userLiked,
      comments: commentRows.map((c) => ({
        id: c.id,
        body: c.body,
        author_label: BilsemPlanEngagementService.authorLabel(c.user as User),
        created_at: c.createdAt.toISOString(),
      })),
    };
  }

  async toggleLike(submissionId: string, userId: string): Promise<{ liked: boolean; like_count: number }> {
    const s = await this.submissionRepo.findOne({ where: { id: submissionId, status: 'published' } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Yayın bulunamadı.' });
    const existing = await this.likeRepo.findOne({ where: { submissionId, userId } });
    if (existing) {
      await this.likeRepo.remove(existing);
    } else {
      await this.likeRepo.save(this.likeRepo.create({ submissionId, userId }));
    }
    const like_count = await this.likeRepo.count({ where: { submissionId } });
    return { liked: !existing, like_count };
  }

  async addComment(submissionId: string, userId: string, rawBody: string) {
    const body = String(rawBody ?? '').trim();
    if (!body) {
      throw new BadRequestException({ code: 'EMPTY', message: 'Yorum boş olamaz.' });
    }
    const s = await this.submissionRepo.findOne({ where: { id: submissionId, status: 'published' } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Yayın bulunamadı.' });
    const row = await this.commentRepo.save(
      this.commentRepo.create({
        submissionId,
        userId,
        body: body.slice(0, 2000),
      }),
    );
    const withUser = await this.commentRepo.findOne({
      where: { id: row.id },
      relations: ['user'],
    });
    return {
      id: row.id,
      body: row.body,
      author_label: BilsemPlanEngagementService.authorLabel(withUser?.user as User),
      created_at: row.createdAt.toISOString(),
    };
  }
}
