import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { MailService } from './mail.service';
import { ContactController } from './contact.controller';

@Module({
  imports: [AppConfigModule],
  controllers: [ContactController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
