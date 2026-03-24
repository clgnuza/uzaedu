import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
import { School } from '../schools/entities/school.entity';
import { UserRole } from '../types/enums';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { paginate } from '../common/dtos/pagination.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(AnnouncementRead)
    private readonly readRepo: Repository<AnnouncementRead>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async list(
    dto: PaginationDto & { school_id?: string },
    scope: { role: UserRole; schoolId: string | null; userId: string },
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.announcementRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.creator', 'creator')
      .orderBy('a.published_at', 'DESC')
      .addOrderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (scope.role === UserRole.school_admin) {
      if (!scope.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
      qb.andWhere('a.school_id = :schoolId', { schoolId: scope.schoolId });
    } else if (scope.role === UserRole.teacher) {
      if (!scope.schoolId) return paginate([], 0, page, limit);
      qb.andWhere('a.school_id = :schoolId', { schoolId: scope.schoolId });
      qb.andWhere('a.published_at IS NOT NULL');
    } else if (scope.role === UserRole.superadmin) {
      if (!scope.schoolId) return paginate([], 0, page, limit);
      qb.andWhere('a.school_id = :schoolId', { schoolId: scope.schoolId });
    }

    const [items, total] = await qb.getManyAndCount();
    const readMap = new Map<string, Date>();
    if (scope.userId && items.length) {
      const reads = await this.readRepo.find({
        where: items.map((a) => ({ user_id: scope.userId, announcement_id: a.id })),
      });
      reads.forEach((r) => readMap.set(r.announcement_id, r.read_at));
    }
    const list = items.map((a) => ({
      ...a,
      read_at: readMap.get(a.id) ?? null,
    }));
    return paginate(list, total, page, limit);
  }

  /**
   * Duyuru TV için, herkese açık (JWT'siz) içerik listesi.
   * Sadece show_on_tv = true ve published_at dolu kayıtlar döner.
   * Zamanlanmış içerik: scheduled_from/scheduled_until kontrolü.
   * school_id verilirse sadece o okulun duyuruları döner.
   */
  async listForTv(
    audience?: 'corridor' | 'teachers' | 'classroom',
    schoolId?: string,
  ): Promise<Announcement[]> {
    const now = new Date();
    const qb = this.announcementRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.creator', 'creator')
      .where('a.show_on_tv = :show', { show: true })
      .andWhere('a.published_at IS NOT NULL')
      .andWhere(
        '(a.scheduled_from IS NULL OR a.scheduled_from <= :now)',
        { now },
      )
      .andWhere(
        '(a.scheduled_until IS NULL OR a.scheduled_until >= :now)',
        { now },
      )
      .orderBy('a.published_at', 'DESC')
      .addOrderBy('a.created_at', 'DESC');

    if (schoolId) {
      qb.andWhere('a.school_id = :schoolId', { schoolId });
    }

    if (audience === 'corridor' || audience === 'teachers') {
      qb.andWhere(
        '(a.tv_audience = :audience OR a.tv_audience = :both OR a.tv_audience = :all OR a.tv_audience IS NULL)',
        { audience, both: 'both', all: 'all' },
      );
    } else if (audience === 'classroom') {
      qb.andWhere('(a.tv_audience = :classroom OR a.tv_audience = :all)', {
        classroom: 'classroom',
        all: 'all',
      });
    }

    return qb.getMany();
  }

  /**
   * Acil duyuru override: urgent_override_until > now olan ilk duyuru.
   */
  async getUrgentOverride(schoolId?: string): Promise<Announcement | null> {
    const now = new Date();
    const qb = this.announcementRepo
      .createQueryBuilder('a')
      .where('a.show_on_tv = :show', { show: true })
      .andWhere('a.published_at IS NOT NULL')
      .andWhere('a.urgent_override_until IS NOT NULL')
      .andWhere('a.urgent_override_until > :now', { now })
      .orderBy('a.urgent_override_until', 'ASC')
      .take(1);
    if (schoolId) qb.andWhere('a.school_id = :schoolId', { schoolId });
    const items = await qb.getMany();
    return items[0] ?? null;
  }

  async findById(id: string, scope: { role: UserRole; schoolId: string | null }): Promise<Announcement> {
    const a = await this.announcementRepo.findOne({
      where: { id },
      relations: ['school', 'creator'],
    });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (scope.role === UserRole.school_admin && a.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (scope.role === UserRole.teacher && (a.school_id !== scope.schoolId || !a.published_at)) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    return a;
  }

  async create(
    dto: CreateAnnouncementDto,
    scope: { role: UserRole; schoolId: string | null; userId: string },
  ): Promise<Announcement> {
    if (!scope.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (scope.role === UserRole.superadmin) {
      const school = await this.schoolRepo.findOne({ where: { id: scope.schoolId } });
      if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    }
    const a = this.announcementRepo.create({
      school_id: scope.schoolId,
      title: dto.title,
      summary: dto.summary ?? null,
      body: dto.body ?? null,
      importance: dto.importance ?? 'normal',
      category: dto.category ?? 'general',
      show_on_tv: dto.show_on_tv ?? false,
      tv_slot: dto.tv_slot ?? null,
      tv_audience: dto.tv_audience ?? 'both',
      published_at: dto.publish ? new Date() : null,
      attachment_url: dto.attachment_url ?? null,
      youtube_url: dto.youtube_url ?? null,
      tv_wait_for_video_end: dto.tv_wait_for_video_end ?? false,
      tv_slide_duration_seconds: dto.tv_slide_duration_seconds ?? null,
      scheduled_from: dto.scheduled_from ?? null,
      scheduled_until: dto.scheduled_until ?? null,
      created_by: scope.userId,
    });
    return this.announcementRepo.save(a);
  }

  async update(
    id: string,
    dto: UpdateAnnouncementDto,
    scope: { schoolId: string | null },
  ): Promise<Announcement> {
    const a = await this.announcementRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (scope.schoolId !== a.school_id) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (dto.title !== undefined) a.title = dto.title;
    if (dto.summary !== undefined) a.summary = dto.summary;
    if (dto.body !== undefined) a.body = dto.body;
    if (dto.importance !== undefined) a.importance = dto.importance;
    if (dto.category !== undefined) a.category = dto.category;
    if (dto.show_on_tv !== undefined) a.show_on_tv = dto.show_on_tv;
    if (dto.tv_slot !== undefined) a.tv_slot = dto.tv_slot;
    if (dto.tv_audience !== undefined) a.tv_audience = dto.tv_audience;
    if (dto.attachment_url !== undefined) a.attachment_url = dto.attachment_url;
    if (dto.youtube_url !== undefined) a.youtube_url = dto.youtube_url;
    if (dto.tv_wait_for_video_end !== undefined) a.tv_wait_for_video_end = dto.tv_wait_for_video_end;
    if (dto.publish === true && !a.published_at) a.published_at = new Date();
    if (dto.publish === false) a.published_at = null;
    if (dto.urgent_override_minutes !== undefined) {
      if (dto.urgent_override_minutes > 0) {
        const until = new Date();
        until.setMinutes(until.getMinutes() + dto.urgent_override_minutes);
        a.urgent_override_until = until;
      } else {
        a.urgent_override_until = null;
      }
    }
    if (dto.tv_slide_duration_seconds !== undefined) a.tv_slide_duration_seconds = dto.tv_slide_duration_seconds;
    if (dto.scheduled_from !== undefined) a.scheduled_from = dto.scheduled_from ? new Date(dto.scheduled_from) : null;
    if (dto.scheduled_until !== undefined) a.scheduled_until = dto.scheduled_until ? new Date(dto.scheduled_until) : null;
    return this.announcementRepo.save(a);
  }

  async remove(id: string, scope: { schoolId: string | null }): Promise<void> {
    const a = await this.announcementRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (scope.schoolId !== a.school_id) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    await this.announcementRepo.remove(a);
  }

  async markRead(announcementId: string, userId: string): Promise<{ read_at: string }> {
    const a = await this.announcementRepo.findOne({ where: { id: announcementId } });
    if (!a) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    const existing = await this.readRepo.findOne({
      where: { user_id: userId, announcement_id: announcementId },
    });
    const now = new Date();
    if (!existing) {
      await this.readRepo.save(this.readRepo.create({ user_id: userId, announcement_id: announcementId, read_at: now }));
    }
    return { read_at: now.toISOString() };
  }
}
