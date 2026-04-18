import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../app-config/app-config.module';
import { User } from '../users/entities/user.entity';
import { MailService } from './mail.service';
import { ContactController } from './contact.controller';
import { ContactSubmission } from './entities/contact-submission.entity';
import { ContactSubmissionsService } from './contact-submissions.service';
import { ContactSubmissionsAdminController } from './contact-submissions-admin.controller';

@Module({
  imports: [AppConfigModule, TypeOrmModule.forFeature([ContactSubmission, User])],
  controllers: [ContactController, ContactSubmissionsAdminController],
  providers: [MailService, ContactSubmissionsService],
  exports: [MailService],
})
export class MailModule {}
