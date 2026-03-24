import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { MailService } from './mail.service';

@Module({
  imports: [AppConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
