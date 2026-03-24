import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../app-config/app-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { TeacherInviteCode } from './entities/teacher-invite-code.entity';
import { TeacherInviteRedemption } from './entities/teacher-invite-redemption.entity';
import { TeacherInviteService } from './teacher-invite.service';
import { TeacherInviteController } from './teacher-invite.controller';

@Module({
  imports: [
    AppConfigModule,
    NotificationsModule,
    TypeOrmModule.forFeature([TeacherInviteCode, TeacherInviteRedemption, User]),
  ],
  controllers: [TeacherInviteController],
  providers: [TeacherInviteService],
  exports: [TeacherInviteService],
})
export class TeacherInviteModule {}
