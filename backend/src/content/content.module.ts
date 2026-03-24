import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentChannel } from './entities/content-channel.entity';
import { ContentSource } from './entities/content-source.entity';
import { ContentItem } from './entities/content-item.entity';
import { ContentService } from './content.service';
import { ContentSyncService } from './content-sync.service';
import { ContentController } from './content.controller';
import { ContentAdminController } from './content-admin.controller';
import { ContentPublicController } from './content-public.controller';
import { UsersModule } from '../users/users.module';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentChannel, ContentSource, ContentItem]),
    UsersModule,
    AppConfigModule,
  ],
  controllers: [ContentController, ContentAdminController, ContentPublicController],
  providers: [ContentService, ContentSyncService],
  exports: [ContentService],
})
export class ContentModule {}
