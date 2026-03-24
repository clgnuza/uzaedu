import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminMessage } from './entities/admin-message.entity';
import { AdminMessageRead } from './entities/admin-message-read.entity';
import { School } from '../schools/entities/school.entity';
import { AdminMessagesService } from './admin-messages.service';
import { AdminMessagesController } from './admin-messages.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminMessage, AdminMessageRead, School]),
  ],
  controllers: [AdminMessagesController],
  providers: [AdminMessagesService],
  exports: [AdminMessagesService],
})
export class AdminMessagesModule {}
