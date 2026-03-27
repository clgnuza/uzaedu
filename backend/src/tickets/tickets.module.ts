import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketAttachment } from './entities/ticket-attachment.entity';
import { TicketEvent } from './entities/ticket-event.entity';
import { TicketModule as TicketModuleEntity } from './entities/ticket-module.entity'; // entity, not Nest module
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { TicketsService } from './tickets.service';
import { TicketAutoCloseScheduler } from './ticket-auto-close.scheduler';
import { TicketsController } from './tickets.controller';
import { TicketModulesController } from './ticket-modules.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketMessage,
      TicketAttachment,
      TicketEvent,
      TicketModuleEntity,
      User,
      School,
    ]),
    NotificationsModule,
    AppConfigModule,
  ],
  controllers: [TicketsController, TicketModulesController],
  providers: [TicketsService, TicketAutoCloseScheduler],
  exports: [TicketsService],
})
export class TicketsModule {}
