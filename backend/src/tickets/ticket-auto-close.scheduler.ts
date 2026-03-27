import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketEvent } from './entities/ticket-event.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { env } from '../config/env';

@Injectable()
export class TicketAutoCloseScheduler {
  private readonly logger = new Logger(TicketAutoCloseScheduler.name);
  private running = false;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketEvent)
    private readonly eventRepo: Repository<TicketEvent>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 * * * *')
  async closeWaitingRequesterTickets(): Promise<void> {
    if (this.running) return;

    const waitDays = env.tickets.autoCloseWaitingRequesterDays;
    if (!Number.isFinite(waitDays) || waitDays <= 0) return;

    this.running = true;
    try {
      const threshold = new Date(Date.now() - waitDays * 24 * 60 * 60 * 1000);
      const tickets = await this.ticketRepo.find({
        where: {
          status: 'WAITING_REQUESTER',
          last_activity_at: LessThan(threshold),
        },
        relations: ['assignedTo', 'requester'],
        take: 200,
      });

      for (const ticket of tickets) {
        ticket.status = 'CLOSED';
        ticket.closed_at = new Date();
        ticket.resolved_at = null;
        ticket.last_activity_at = new Date();
        await this.ticketRepo.save(ticket);

        await this.eventRepo.save({
          ticket_id: ticket.id,
          actor_user_id: ticket.assigned_to_user_id || ticket.created_by_user_id,
          event_type: 'auto_closed_waiting_requester',
          payload_json: { after_days: waitDays },
        });

        await this.notificationsService.createInboxEntry({
          user_id: ticket.requester_user_id,
          event_type: 'support.ticket.auto_closed',
          entity_id: ticket.id,
          target_screen: `support/tickets/${ticket.id}`,
          title: 'Destek talebi otomatik kapatıldı',
          body: `${waitDays} gün yanıt gelmediği için talep kapatıldı: ${ticket.subject}`,
        });

        if (ticket.assigned_to_user_id && ticket.assigned_to_user_id !== ticket.requester_user_id) {
          await this.notificationsService.createInboxEntry({
            user_id: ticket.assigned_to_user_id,
            event_type: 'support.ticket.auto_closed',
            entity_id: ticket.id,
            target_screen: `support/tickets/${ticket.id}`,
            title: 'Talep otomatik kapatıldı',
            body: `${waitDays} gün yanıt gelmediği için kapatıldı: ${ticket.subject}`,
          });
        }
      }

      if (tickets.length > 0) {
        this.logger.log(`[Tickets] waiting_requester otomatik kapatma: ${tickets.length} talep`);
      }
    } catch (error) {
      this.logger.error('[Tickets] waiting_requester otomatik kapatma hatası', error);
    } finally {
      this.running = false;
    }
  }
}
