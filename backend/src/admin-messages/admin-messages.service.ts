import { randomUUID } from 'crypto';
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdminMessage } from './entities/admin-message.entity';
import { AdminMessageRead } from './entities/admin-message-read.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAdminMessageDto } from './dto/create-admin-message.dto';
import { ListAdminMessagesDto } from './dto/list-admin-messages.dto';
import { PaginationDto, paginate } from '../common/dtos/pagination.dto';

@Injectable()
export class AdminMessagesService {
  constructor(
    @InjectRepository(AdminMessage)
    private readonly messageRepo: Repository<AdminMessage>,
    @InjectRepository(AdminMessageRead)
    private readonly readRepo: Repository<AdminMessageRead>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    dto: CreateAdminMessageDto,
    scope: { userId: string },
  ) {
    const sendBatchId = randomUUID();
    const messages: AdminMessage[] = [];
    for (const schoolId of dto.school_ids) {
      const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
      if (!school) continue;
      const msg = this.messageRepo.create({
        school_id: schoolId,
        title: dto.title.trim(),
        body: dto.body?.trim() || null,
        image_url: dto.image_url?.trim() || null,
        created_by: scope.userId,
        send_batch_id: sendBatchId,
      });
      await this.messageRepo.save(msg);
      messages.push(msg);
      await this.notifyTeachersForSchoolMessage(msg);
    }
    return {
      created: messages.length,
      ids: messages.map((m) => m.id),
      send_batch_id: sendBatchId,
    };
  }

  /** Okuldaki öğretmenlere gelen kutusu bildirimi (tam metin yalnız okul yöneticisi Sistem Mesajları’nda). */
  private async notifyTeachersForSchoolMessage(msg: AdminMessage): Promise<void> {
    const school = await this.schoolRepo.findOne({ where: { id: msg.school_id } });
    const schoolName = school?.name?.trim() || 'Okulunuz';
    const teachers = await this.userRepo.find({
      where: { school_id: msg.school_id, role: UserRole.teacher },
      select: ['id'],
    });
    const preview = msg.body?.trim()
      ? msg.body.trim().slice(0, 180) + (msg.body.trim().length > 180 ? '…' : '')
      : undefined;
    for (const t of teachers) {
      await this.notificationsService.createInboxEntry({
        user_id: t.id,
        event_type: 'admin_message.sent',
        entity_id: msg.id,
        target_screen: 'dashboard',
        title: 'Yeni sistem mesajı',
        body: preview
          ? `${schoolName}: ${msg.title}\n${preview}`
          : `${schoolName}: ${msg.title}`,
        metadata: { message_id: msg.id, school_id: msg.school_id },
      });
    }
  }

  /** Superadmin: gönderim özetleri (batch başına bir satır). */
  async listSentBatches(dto: PaginationDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const totalRow = await this.messageRepo.query(
      `SELECT COUNT(*)::int AS c FROM (SELECT 1 FROM admin_messages GROUP BY COALESCE(send_batch_id, id)) x`,
    );
    const total = totalRow[0]?.c ?? 0;

    const raw = (await this.messageRepo.query(
      `SELECT
         COALESCE(m.send_batch_id, m.id) AS batch_id,
         MAX(m.created_at) AS created_at,
         MAX(m.title) AS title,
         COUNT(m.id)::int AS school_count,
         COUNT(DISTINCT r.message_id)::int AS read_count
       FROM admin_messages m
       LEFT JOIN admin_message_reads r ON r.message_id = m.id
       GROUP BY COALESCE(m.send_batch_id, m.id)
       ORDER BY MAX(m.created_at) DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )) as {
      batch_id: string;
      created_at: Date;
      title: string;
      school_count: number;
      read_count: number;
    }[];

    if (!raw.length) {
      return paginate([], total, page, limit);
    }

    const batchIds = raw.map((r) => r.batch_id);
    const sampleRows = (await this.messageRepo.query(
      `SELECT DISTINCT ON (COALESCE(send_batch_id, id)) COALESCE(send_batch_id, id) AS "batch_id", id AS "id"
       FROM admin_messages
       WHERE COALESCE(send_batch_id, id) = ANY($1::uuid[])
       ORDER BY COALESCE(send_batch_id, id), created_at ASC`,
      [batchIds],
    )) as { batch_id: string; id: string }[];
    const sampleIds = sampleRows.map((r) => r.id);
    const sampleMsgs = sampleIds.length
      ? await this.messageRepo.find({
          where: { id: In(sampleIds) },
          relations: ['creator'],
        })
      : [];
    const byId = new Map(sampleMsgs.map((m) => [m.id, m]));
    const firstByBatch = new Map<string, AdminMessage>();
    for (const row of sampleRows) {
      const m = byId.get(row.id);
      if (m) firstByBatch.set(row.batch_id, m);
    }

    const items = raw.map((r) => {
      const m = firstByBatch.get(r.batch_id);
      return {
        batch_id: r.batch_id,
        title: r.title,
        body: m?.body ?? null,
        image_url: m?.image_url ?? null,
        created_at: r.created_at,
        school_count: r.school_count,
        read_count: r.read_count,
        creator: m?.creator
          ? { display_name: m.creator.display_name ?? null, email: m.creator.email }
          : null,
      };
    });

    return paginate(items, total, page, limit);
  }

  /** Bir gönderimde okul bazlı iletim / okundu özeti. */
  async getBatchDeliveryReport(batchId: string) {
    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.school', 'school')
      .leftJoinAndSelect('m.creator', 'creator')
      .where(
        '(m.send_batch_id = :batchId OR (m.send_batch_id IS NULL AND m.id = :batchId))',
        { batchId },
      )
      .orderBy('school.name', 'ASC')
      .getMany();
    if (!messages.length) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    }

    const messageIds = messages.map((m) => m.id);
    const readRows =
      messageIds.length === 0
        ? []
        : await this.readRepo
            .createQueryBuilder('r')
            .select('r.message_id', 'message_id')
            .addSelect('MAX(r.read_at)', 'read_at')
            .where('r.message_id IN (:...ids)', { ids: messageIds })
            .groupBy('r.message_id')
            .getRawMany<{ message_id: string; read_at: Date }>();

    const readMap = new Map(readRows.map((x) => [x.message_id, new Date(x.read_at)]));

    const head = messages[0];
    const schools = messages.map((m) => ({
      school_id: m.school_id,
      school_name: m.school?.name ?? '',
      city: m.school?.city ?? null,
      district: m.school?.district ?? null,
      message_id: m.id,
      read_at: readMap.get(m.id)?.toISOString() ?? null,
    }));

    return {
      batch_id: batchId,
      title: head.title,
      body: head.body,
      image_url: head.image_url,
      created_at: head.created_at,
      creator: head.creator
        ? { display_name: head.creator.display_name ?? null, email: head.creator.email }
        : null,
      school_count: schools.length,
      read_count: schools.filter((s) => s.read_at).length,
      schools,
    };
  }

  /** Bir gönderimdeki tüm okul mesajlarını ve okuma kayıtlarını siler (CASCADE). */
  async deleteBatch(batchId: string) {
    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .where('(m.send_batch_id = :batchId OR (m.send_batch_id IS NULL AND m.id = :batchId))', { batchId })
      .getMany();
    if (!messages.length) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    }
    await this.messageRepo.remove(messages);
    return { deleted: messages.length };
  }

  async list(
    dto: ListAdminMessagesDto,
    scope: { role: UserRole; schoolId: string | null; userId?: string },
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    if (scope.role === UserRole.school_admin) {
      if (!scope.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
      const qb = this.messageRepo
        .createQueryBuilder('m')
        .leftJoinAndSelect('m.creator', 'creator')
        .where('m.school_id = :schoolId', { schoolId: scope.schoolId })
        .orderBy('m.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
      const [items, total] = await qb.getManyAndCount();
      const readMap = scope.userId && items.length
        ? await this.getReadStatus(items.map((m) => m.id), scope.userId)
        : new Map<string, Date>();
      const list = items.map((m) => ({
        ...m,
        read_at: readMap.get(m.id) ?? null,
      }));
      return paginate(list, total, page, limit);
    }

    if (scope.role === UserRole.superadmin) {
      const qb = this.messageRepo
        .createQueryBuilder('m')
        .leftJoinAndSelect('m.creator', 'creator')
        .leftJoinAndSelect('m.school', 'school')
        .orderBy('m.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
      if (dto.school_id) {
        qb.andWhere('m.school_id = :schoolId', { schoolId: dto.school_id });
      }
      const [items, total] = await qb.getManyAndCount();
      return paginate(items, total, page, limit);
    }

    return paginate([], 0, page, limit);
  }

  async findById(
    id: string,
    scope: { role: UserRole; schoolId: string | null },
  ) {
    const msg = await this.messageRepo.findOne({
      where: { id },
      relations: ['creator', 'school'],
    });
    if (!msg) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Mesaj bulunamadı.' });
    if (scope.role === UserRole.school_admin && msg.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu mesaja erişim yetkiniz yok.' });
    }
    return msg;
  }

  async markRead(id: string, userId: string, scope: { schoolId: string | null }) {
    const msg = await this.messageRepo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Mesaj bulunamadı.' });
    if (msg.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu mesaja erişim yetkiniz yok.' });
    }
    const existing = await this.readRepo.findOne({ where: { message_id: id, user_id: userId } });
    if (existing) return { ok: true };
    await this.readRepo.save({
      message_id: id,
      user_id: userId,
      read_at: new Date(),
    });
    return { ok: true };
  }

  async getUnreadCount(scope: { schoolId: string | null; userId: string }): Promise<number> {
    if (!scope.schoolId) return 0;
    const messages = await this.messageRepo.find({
      where: { school_id: scope.schoolId },
      select: ['id'],
    });
    if (!messages.length) return 0;
    const reads = await this.readRepo.find({
      where: { user_id: scope.userId, message_id: In(messages.map((m) => m.id)) },
      select: ['message_id'],
    });
    const readIds = new Set(reads.map((r) => r.message_id));
    return messages.filter((m) => !readIds.has(m.id)).length;
  }

  async getReadStatus(
    messageIds: string[],
    userId: string,
  ): Promise<Map<string, Date>> {
    if (!messageIds.length) return new Map();
    const reads = await this.readRepo.find({
      where: messageIds.map((mid) => ({ message_id: mid, user_id: userId })),
    });
    const map = new Map<string, Date>();
    reads.forEach((r) => map.set(r.message_id, r.read_at));
    return map;
  }
}
