import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { GeneratedFilesCleanupScheduler } from './generated-files-cleanup.scheduler';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [AppConfigModule],
  controllers: [UploadController],
  providers: [UploadService, GeneratedFilesCleanupScheduler],
  exports: [UploadService],
})
export class UploadModule {}
