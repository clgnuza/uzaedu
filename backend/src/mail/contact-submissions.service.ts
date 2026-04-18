import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ContactSubmission } from './entities/contact-submission.entity';
import { MailService } from './mail.service';
import { ListContactSubmissionsDto } from './dto/list-contact-submissions.dto';

@Injectable()
export class ContactSubmissionsService {
  constructor(
    @InjectRepository(ContactSubmission)
    private readonly repo: Repository<ContactSubmission>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  async createFromPublicForm(params: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<ContactSubmission> {
    const row = this.repo.create({
      name: params.name,
      email: params.email,
      subject: params.subject,
      message: params.message,
      notify_email_sent: false,
      status: 'new',
    });
    await this.repo.save(row);
    const sent = await this.mail.sendContactInboxNotification(row);
    if (sent) {
      row.notify_email_sent = true;
      await this.repo.save(row);
    }
    return row;
  }

  async listForStaff(dto: ListContactSubmissionsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.repo.createQueryBuilder('c').orderBy('c.created_at', 'DESC');
    const st = dto.status ?? 'all';
    if (st !== 'all') qb.andWhere('c.status = :st', { st });
    const total = await qb.clone().getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const items = rows.map((r) => this.toAdminListItem(r));
    return { total, page, limit, items };
  }

  toAdminListItem(row: ContactSubmission) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      created_at: row.created_at,
      status: row.status,
      notify_email_sent: row.notify_email_sent,
      first_read_at: row.first_read_at,
      reply_sent_at: row.reply_sent_at,
    };
  }

  toAdminDetail(row: ContactSubmission) {
    return {
      ...this.toAdminListItem(row),
      message: row.message,
      reply_body: row.reply_body,
      replied_by: row.replied_by
        ? { id: row.replied_by.id, display_name: row.replied_by.display_name ?? row.replied_by.email }
        : null,
    };
  }

  async getOneForStaff(id: string): Promise<ContactSubmission> {
    const row = await this.repo.findOne({
      where: { id },
      relations: { replied_by: true },
    });
    if (!row) throw new NotFoundException('Kayıt bulunamadı');
    return row;
  }

  async markReadIfNew(id: string): Promise<void> {
    const row = await this.repo.findOneBy({ id });
    if (row && !row.first_read_at) {
      row.first_read_at = new Date();
      await this.repo.save(row);
    }
  }

  async replyAsStaff(id: string, userId: string, message: string) {
    const row = await this.getOneForStaff(id);
    if (row.reply_sent_at) {
      throw new ConflictException('Bu mesaja zaten yanıt gönderildi.');
    }
    const staff = await this.users.findOne({ where: { id: userId } });
    const replierLabel =
      (staff?.display_name?.trim() || staff?.email?.trim() || 'Uzaedu Öğretmen ekibi').slice(0, 120);
    const ok = await this.mail.sendContactFormReplyToUser({
      toEmail: row.email,
      userSubject: row.subject,
      replyText: message.trim(),
      originalMessage: row.message,
      submitterName: row.name.trim(),
      replierLabel,
      submissionId: row.id,
    });
    if (!ok) {
      throw new HttpException(
        'E-posta gönderilemedi. Web Ayarları → Mail: mail açık mı, SMTP bilgileri ve (Gmail için) uygulama şifresi doğru mu kontrol edin.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    row.reply_body = message.trim();
    row.reply_sent_at = new Date();
    row.replied_by = staff;
    row.status = 'replied';
    if (!row.first_read_at) row.first_read_at = new Date();
    await this.repo.save(row);
    const out = await this.getOneForStaff(id);
    return this.toAdminDetail(out);
  }

  async setStatus(id: string, status: 'new' | 'archived') {
    const row = await this.getOneForStaff(id);
    if (status === 'new' && row.status !== 'archived') {
      throw new BadRequestException('Yalnızca arşivlenmiş kayıtlar yeniden açılabilir.');
    }
    row.status = status;
    await this.repo.save(row);
    return this.toAdminDetail(await this.getOneForStaff(id));
  }
}
