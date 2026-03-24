import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketAttachment } from './entities/ticket-attachment.entity';
import { TicketEvent } from './entities/ticket-event.entity';
import { TicketModule } from './entities/ticket-module.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { UserRole } from '../types/enums';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { paginate } from '../common/dtos/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_REQUESTER' | 'RESOLVED' | 'CLOSED';

interface TicketScope {
  role: UserRole;
  schoolId: string | null;
  userId: string;
  moderatorModules?: string[];
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(TicketAttachment)
    private readonly attachmentRepo: Repository<TicketAttachment>,
    @InjectRepository(TicketEvent)
    private readonly eventRepo: Repository<TicketEvent>,
    @InjectRepository(TicketModule)
    private readonly moduleRepo: Repository<TicketModule>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TCK-${year}-`;
    const result = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.ticket_number')
      .where('t.ticket_number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('t.ticket_number', 'DESC')
      .limit(1)
      .getOne();
    let seq = 1;
    if (result) {
      const match = result.ticket_number.match( new RegExp(`^TCK-${year}-(\\d+)$`));
      if (match) seq = parseInt(match[1], 10) + 1;
    }
    return `${prefix}${String(seq).padStart(6, '0')}`;
  }

  private canReadTicket(ticket: Ticket, scope: TicketScope): boolean {
    if (scope.role === UserRole.superadmin) return true;
    if (ticket.target_type === 'PLATFORM_SUPPORT') {
      return scope.role === UserRole.school_admin && ticket.school_id === scope.schoolId;
    }
    if (ticket.target_type === 'SCHOOL_SUPPORT') {
      if (ticket.requester_user_id === scope.userId) return true;
      if (scope.role === UserRole.school_admin && ticket.school_id === scope.schoolId) return true;
      if (
        scope.role === UserRole.moderator &&
        ticket.school_id === scope.schoolId &&
        Array.isArray(scope.moderatorModules) &&
        scope.moderatorModules.includes('support')
      ) {
        return true;
      }
    }
    return false;
  }

  private canWriteTicket(ticket: Ticket, scope: TicketScope): boolean {
    if (scope.role === UserRole.superadmin) return true;
    if (ticket.requester_user_id === scope.userId) {
      return true;
    }
    if (ticket.target_type === 'SCHOOL_SUPPORT') {
      if (scope.role === UserRole.school_admin && ticket.school_id === scope.schoolId) return true;
      if (
        scope.role === UserRole.moderator &&
        ticket.school_id === scope.schoolId &&
        Array.isArray(scope.moderatorModules) &&
        scope.moderatorModules.includes('support')
      ) {
        return true;
      }
    }
    return false;
  }

  private isStaffRole(scope: TicketScope): boolean {
    return [UserRole.school_admin, UserRole.moderator, UserRole.superadmin].includes(scope.role);
  }

  async create(dto: CreateTicketDto, scope: TicketScope) {
    let schoolId: string | null = scope.schoolId ?? dto.school_id ?? null;
    if (!schoolId && scope.role !== UserRole.superadmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bu işlem için okul seçimi gereklidir.',
      });
    }
    if (!schoolId) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Okul bilgisi eksik.',
      });
    }

    const module = await this.moduleRepo.findOne({ where: { id: dto.module_id } });
    if (!module || !module.is_active) {
      throw new BadRequestException({
        code: 'NOT_FOUND',
        message: 'Geçersiz modül seçimi.',
      });
    }

    const ticketNumber = await this.generateTicketNumber();
    const ticket = this.ticketRepo.create({
      ticket_number: ticketNumber,
      school_id: schoolId,
      target_type: dto.target_type,
      module_id: dto.module_id,
      issue_type: dto.issue_type,
      priority: dto.priority ?? 'MEDIUM',
      status: 'OPEN',
      subject: dto.subject.trim(),
      requester_user_id: scope.userId,
      created_by_user_id: scope.userId,
    });

    let assignedToId: string | null = null;
    if (dto.target_type === 'SCHOOL_SUPPORT') {
      const admin = await this.userRepo.findOne({
        where: { school_id: schoolId, role: UserRole.school_admin },
      });
      assignedToId = admin?.id ?? null;
    }
    if (assignedToId) ticket.assigned_to_user_id = assignedToId;

    const saved = await this.ticketRepo.save(ticket);

    const msg = this.messageRepo.create({
      ticket_id: saved.id,
      author_user_id: scope.userId,
      message_type: 'PUBLIC',
      body: dto.description.trim(),
    });
    const savedMsg = await this.messageRepo.save(msg);

    const attachments = (dto.attachments ?? []).map((a) =>
      this.attachmentRepo.create({
        ticket_message_id: savedMsg.id,
        storage_key: a.key,
        filename: a.filename || a.key.split('/').pop() || 'file',
        mime_type: a.mime_type || 'application/octet-stream',
        size_bytes: a.size_bytes ?? 0,
      }),
    );
    if (attachments.length) await this.attachmentRepo.save(attachments);

    await this.eventRepo.save({
      ticket_id: saved.id,
      actor_user_id: scope.userId,
      event_type: 'created',
      payload_json: { subject: saved.subject },
    });

    if (dto.target_type === 'SCHOOL_SUPPORT' && assignedToId && assignedToId !== scope.userId) {
      await this.notificationsService.createInboxEntry({
        user_id: assignedToId,
        event_type: 'support.ticket.created',
        entity_id: saved.id,
        target_screen: `support/tickets/${saved.id}`,
        title: 'Yeni destek talebi',
        body: saved.subject,
      });
    }
    if (dto.target_type === 'PLATFORM_SUPPORT') {
      const superadmins = await this.userRepo.find({
        where: { role: UserRole.superadmin },
        take: 10,
      });
      const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
      const schoolName = school?.name || 'Okul';
      for (const sa of superadmins) {
        await this.notificationsService.createInboxEntry({
          user_id: sa.id,
          event_type: 'support.ticket.created',
          entity_id: saved.id,
          target_screen: `support/tickets/${saved.id}`,
          title: 'Yeni platform talebi',
          body: `${schoolName}: ${saved.subject}`,
        });
      }
    }

    return this.findById(saved.id, scope);
  }

  async list(dto: ListTicketsDto, scope: TicketScope) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.module', 'module')
      .leftJoinAndSelect('t.requester', 'requester')
      .leftJoinAndSelect('t.assignedTo', 'assignedTo')
      .leftJoinAndSelect('t.school', 'school')
      .orderBy('t.last_activity_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (scope.role === UserRole.teacher) {
      qb.andWhere('t.requester_user_id = :userId', { userId: scope.userId });
    } else if (scope.role === UserRole.school_admin && scope.schoolId) {
      const mode = dto.list_mode ?? 'owned';
      if (mode === 'owned') {
        qb.andWhere('t.requester_user_id = :userId', { userId: scope.userId });
      } else if (mode === 'school_inbox') {
        qb.andWhere('t.school_id = :schoolId', { schoolId: scope.schoolId });
        qb.andWhere('t.target_type = :st', { st: 'SCHOOL_SUPPORT' });
      } else {
        qb.andWhere('t.school_id = :schoolId', { schoolId: scope.schoolId });
      }
    } else if (scope.role === UserRole.moderator && scope.schoolId) {
      if (!scope.moderatorModules?.includes('support')) {
        return paginate([], 0, page, limit);
      }
      qb.andWhere('t.school_id = :schoolId', { schoolId: scope.schoolId });
      qb.andWhere('t.target_type = :st', { st: 'SCHOOL_SUPPORT' });
    } else if (scope.role === UserRole.superadmin) {
      if (dto.school_id) qb.andWhere('t.school_id = :schoolId', { schoolId: dto.school_id });
      if (dto.target_type) qb.andWhere('t.target_type = :tt', { tt: dto.target_type });
    }

    if (dto.target_type) qb.andWhere('t.target_type = :tt', { tt: dto.target_type });
    if (dto.status) qb.andWhere('t.status = :status', { status: dto.status });
    if (dto.module_id) qb.andWhere('t.module_id = :moduleId', { moduleId: dto.module_id });
    if (dto.priority) qb.andWhere('t.priority = :priority', { priority: dto.priority });
    if (dto.assigned_to) qb.andWhere('t.assigned_to_user_id = :aid', { aid: dto.assigned_to });
    if (dto.q?.trim()) {
      qb.andWhere('(t.subject ILIKE :q OR t.ticket_number ILIKE :q)', {
        q: `%${dto.q.trim()}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async findById(id: string, scope: TicketScope) {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['module', 'requester', 'createdBy', 'assignedTo', 'school', 'escalatedFrom', 'escalatedTo'],
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'İstediğiniz talep bulunamadı.',
      });
    }
    if (!this.canReadTicket(ticket, scope)) {
      throw new ForbiddenException({
        code: 'TICKET_SCOPE_VIOLATION',
        message: 'Bu talebe erişim yetkiniz yok.',
      });
    }
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, scope: TicketScope) {
    const ticket = await this.findById(id, scope);
    if (!this.canWriteTicket(ticket, scope)) {
      throw new ForbiddenException({
        code: 'TICKET_SCOPE_VIOLATION',
        message: 'Bu talebi güncelleme yetkiniz yok.',
      });
    }

    if (scope.role === UserRole.teacher) {
      if (dto.status && dto.status !== 'RESOLVED') {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Öğretmen sadece "Çözüldü" işaretleyebilir.',
        });
      }
    }

    if (dto.status) {
      const prevStatus = ticket.status;
      ticket.status = dto.status as TicketStatus;
      if (dto.status === 'RESOLVED') ticket.resolved_at = new Date();
      if (dto.status === 'CLOSED') ticket.closed_at = new Date();
      await this.eventRepo.save({
        ticket_id: id,
        actor_user_id: scope.userId,
        event_type: 'status_changed',
        payload_json: { from: prevStatus, to: dto.status },
      });
    }
    if (dto.assigned_to_user_id !== undefined) {
      const prev = ticket.assigned_to_user_id;
      ticket.assigned_to_user_id = dto.assigned_to_user_id;
      if (dto.assigned_to_user_id && dto.assigned_to_user_id !== prev) {
        await this.notificationsService.createInboxEntry({
          user_id: dto.assigned_to_user_id,
          event_type: 'support.ticket.assigned',
          entity_id: id,
          target_screen: `support/tickets/${id}`,
          title: 'Size destek talebi atandı',
          body: ticket.subject,
        });
      }
    }
    if (dto.priority) ticket.priority = dto.priority as any;
    if (dto.module_id) ticket.module_id = dto.module_id;

    await this.ticketRepo.save(ticket);
    return this.findById(id, scope);
  }

  async escalate(id: string, reason: string, extraInfo: string | undefined, scope: TicketScope) {
    const ticket = await this.findById(id, scope);
    if (ticket.target_type !== 'SCHOOL_SUPPORT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Sadece okul içi talepler platforma eskale edilebilir.',
      });
    }
    if (scope.role !== UserRole.school_admin && scope.role !== UserRole.superadmin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Eskalasyon yetkiniz yok.',
      });
    }
    if (ticket.school_id !== scope.schoolId && scope.role !== UserRole.superadmin) {
      throw new ForbiddenException({
        code: 'TICKET_SCOPE_VIOLATION',
        message: 'Bu talebe erişim yetkiniz yok.',
      });
    }
    if (ticket.escalated_to_ticket_id) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Bu talep zaten platforma eskale edilmiş.',
      });
    }

    const ticketNumber = await this.generateTicketNumber();
    const platformTicket = this.ticketRepo.create({
      ticket_number: ticketNumber,
      school_id: ticket.school_id,
      target_type: 'PLATFORM_SUPPORT',
      module_id: ticket.module_id,
      issue_type: ticket.issue_type,
      priority: ticket.priority,
      status: 'OPEN',
      subject: `[Eskale] ${ticket.subject}`,
      requester_user_id: ticket.requester_user_id,
      created_by_user_id: scope.userId,
      escalated_from_ticket_id: ticket.id,
    });
    const savedPlatform = await this.ticketRepo.save(platformTicket);

    ticket.escalated_to_ticket_id = savedPlatform.id;
    await this.ticketRepo.save(ticket);

    const summaryLines: string[] = [
      `Eskalasyon sebebi: ${reason}`,
      '',
      '--- Önceki mesajlar özeti ---',
    ];
    const msgs = await this.messageRepo.find({
      where: { ticket_id: ticket.id },
      relations: ['author'],
      order: { created_at: 'ASC' },
    });
    for (const m of msgs) {
      if (m.message_type === 'PUBLIC') {
        const authorName = (m.author as User)?.display_name || 'Kullanıcı';
        summaryLines.push(`[${authorName}]: ${m.body.slice(0, 200)}${m.body.length > 200 ? '...' : ''}`);
      }
    }
    if (extraInfo?.trim()) {
      summaryLines.push('');
      summaryLines.push('Ek bilgi: ' + extraInfo.trim());
    }

    const summaryMsg = this.messageRepo.create({
      ticket_id: savedPlatform.id,
      author_user_id: scope.userId,
      message_type: 'PUBLIC',
      body: summaryLines.join('\n'),
    });
    await this.messageRepo.save(summaryMsg);

    await this.eventRepo.save({
      ticket_id: ticket.id,
      actor_user_id: scope.userId,
      event_type: 'escalated',
      payload_json: { to_ticket_id: savedPlatform.id, reason },
    });

    const superadmins = await this.userRepo.find({
      where: { role: UserRole.superadmin },
      take: 5,
    });
    const school = await this.schoolRepo.findOne({ where: { id: ticket.school_id } });
    const schoolName = school?.name || 'Okul';
    for (const sa of superadmins) {
      await this.notificationsService.createInboxEntry({
        user_id: sa.id,
        event_type: 'support.ticket.escalated',
        entity_id: savedPlatform.id,
        target_screen: `support/tickets/${savedPlatform.id}`,
        title: 'Üst birime iletildi',
        body: `${schoolName}: ${ticket.subject}`,
      });
    }

    return { ticket: await this.findById(savedPlatform.id, scope), original_ticket_id: ticket.id };
  }

  async addMessage(
    id: string,
    dto: CreateTicketMessageDto,
    scope: TicketScope,
  ) {
    const ticket = await this.findById(id, scope);
    if (!this.canWriteTicket(ticket, scope)) {
      throw new ForbiddenException({
        code: 'TICKET_SCOPE_VIOLATION',
        message: 'Bu talebe mesaj yazma yetkiniz yok.',
      });
    }
    if (dto.message_type === 'INTERNAL_NOTE' && !this.isStaffRole(scope)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'İç not yalnızca destek personeli ekleyebilir.',
      });
    }
    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
      throw new ForbiddenException({
        code: 'TICKET_FINALIZED',
        message: 'Çözülmüş veya kapatılmış taleplere yeni mesaj eklenemez.',
      });
    }
    if (ticket.status === 'WAITING_REQUESTER' && scope.userId === ticket.requester_user_id) {
      ticket.status = 'IN_PROGRESS';
      await this.ticketRepo.save(ticket);
    }

    const msg = this.messageRepo.create({
      ticket_id: id,
      author_user_id: scope.userId,
      message_type: dto.message_type,
      body: dto.body.trim(),
    });
    const savedMsg = await this.messageRepo.save(msg);

    const attachments = (dto.attachments ?? []).map((a) =>
      this.attachmentRepo.create({
        ticket_message_id: savedMsg.id,
        storage_key: a.key,
        filename: a.filename || a.key.split('/').pop() || 'file',
        mime_type: a.mime_type || 'application/octet-stream',
        size_bytes: a.size_bytes ?? 0,
      }),
    );
    if (attachments.length) await this.attachmentRepo.save(attachments);

    ticket.last_activity_at = new Date();
    await this.ticketRepo.save(ticket);

    await this.eventRepo.save({
      ticket_id: id,
      actor_user_id: scope.userId,
      event_type: 'message_added',
      payload_json: { message_type: dto.message_type },
    });

    if (dto.message_type === 'PUBLIC' && scope.userId !== ticket.requester_user_id) {
      await this.notificationsService.createInboxEntry({
        user_id: ticket.requester_user_id,
        event_type: 'support.ticket.replied',
        entity_id: id,
        target_screen: `support/tickets/${id}`,
        title: 'Talebinize yanıt verildi',
        body: ticket.subject,
      });
    }

    return savedMsg;
  }

  async listMessages(id: string, page: number, limit: number, scope: TicketScope) {
    const ticket = await this.findById(id, scope);
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.author', 'author')
      .leftJoinAndSelect('m.attachments', 'attachments')
      .where('m.ticket_id = :id', { id })
      .orderBy('m.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (ticket.requester_user_id === scope.userId && !this.isStaffRole(scope)) {
      qb.andWhere('m.message_type = :pub', { pub: 'PUBLIC' });
    }

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async getAssignableUsers(scope: TicketScope, schoolId?: string | null) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.display_name', 'u.email', 'u.role'])
      .where('u.status = :status', { status: 'active' })
      .orderBy('u.display_name', 'ASC');

    if (scope.role === UserRole.superadmin) {
      qb.andWhere('u.role IN (:...roles)', {
        roles: [UserRole.superadmin, UserRole.school_admin, UserRole.moderator],
      });
      if (schoolId) qb.andWhere('u.school_id = :schoolId', { schoolId });
    } else if (scope.role === UserRole.school_admin && scope.schoolId) {
      const sid = schoolId ?? scope.schoolId;
      qb.andWhere('u.school_id = :schoolId', { schoolId: sid });
      qb.andWhere('u.role IN (:...roles)', {
        roles: [UserRole.school_admin, UserRole.moderator],
      });
    } else if (scope.role === UserRole.moderator && scope.schoolId) {
      qb.andWhere('u.school_id = :schoolId', { schoolId: scope.schoolId });
      qb.andWhere('u.role IN (:...roles)', {
        roles: [UserRole.school_admin, UserRole.moderator],
      });
    } else {
      return [];
    }

    return qb.getMany();
  }

  async getModules(targetType?: 'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT') {
    const qb = this.moduleRepo
      .createQueryBuilder('m')
      .where('m.is_active = :active', { active: true })
      .orderBy('m.sort_order', 'ASC')
      .addOrderBy('m.name', 'ASC');

    if (targetType === 'SCHOOL_SUPPORT') {
      qb.andWhere("(m.target_availability = 'SCHOOL_ONLY' OR m.target_availability = 'BOTH')");
    } else if (targetType === 'PLATFORM_SUPPORT') {
      qb.andWhere("(m.target_availability = 'PLATFORM_ONLY' OR m.target_availability = 'BOTH')");
    }
    return qb.getMany();
  }
}
