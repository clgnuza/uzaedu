import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SchoolsModule } from '../schools/schools.module';
import { TeacherAgendaModule } from '../teacher-agenda/teacher-agenda.module';
import { MailModule } from '../mail/mail.module';
import { AuthOtpModule } from '../auth/auth-otp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    SchoolsModule,
    TeacherAgendaModule,
    MailModule,
    AuthOtpModule,
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
