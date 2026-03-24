import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdminMessage } from './entities/admin-message.entity';
import { AdminMessageRead } from './entities/admin-message-read.entity';
import { School } from '../schools/entities/school.entity';
import { UserRole } from '../types/enums';
import { CreateAdminMessageDto } from './dto/create-admin-message.dto';
import { ListAdminMessagesDto } from './dto/list-admin-messages.dto';
import { paginate } from '../common/dtos/pagination.dto';

@Injectable()
export class AdminMessagesService {
  constructor(
    @InjectRepository(AdminMessage)
    private readonly messageRepo: Repository<AdminMessage>,
    @InjectRepository(AdminMessageRead)
    private readonly readRepo: Repository<AdminMessageRead>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  async create(
    dto: CreateAdminMessageDto,
    scope: { userId: string },
  ) {
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
      });
      await this.messageRepo.save(msg);
      messages.push(msg);
    }
    return { created: messages.length, ids: messages.map((m) => m.id) };
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
