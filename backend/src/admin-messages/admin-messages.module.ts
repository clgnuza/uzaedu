import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminMessage } from './entities/admin-message.entity';
import { AdminMessageRead } from './entities/admin-message-read.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { AdminMessagesService } from './admin-messages.service';
import { AdminMessagesController } from './admin-messages.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminMessage, AdminMessageRead, School, User]),
    NotificationsModule,
  ],
  controllers: [AdminMessagesController],
  providers: [AdminMessagesService],
  exports: [AdminMessagesService],
})
export class AdminMessagesModule {}
