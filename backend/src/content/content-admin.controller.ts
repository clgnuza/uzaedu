import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../types/enums';
import { ContentService } from './content.service';
import { ListContentItemsDto } from './dto/list-content-items.dto';
import { CreateContentChannelDto } from './dto/create-content-channel.dto';
import { CreateContentSourceDto } from './dto/create-content-source.dto';
import { CreateContentItemDto } from './dto/create-content-item.dto';

@Controller('content/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class ContentAdminController {
  constructor(private readonly contentService: ContentService) {}

  @Get('channels')
  listChannels() {
    return this.contentService.adminListChannels();
  }

  @Post('channels')
  createChannel(@Body() dto: CreateContentChannelDto) {
    return this.contentService.adminCreateChannel(dto);
  }

  @Patch('channels/:id')
  updateChannel(@Param('id') id: string, @Body() dto: Partial<CreateContentChannelDto>) {
    return this.contentService.adminUpdateChannel(id, dto);
  }

  @Get('sources')
  listSources() {
    return this.contentService.adminListSources();
  }

  @Post('sources')
  createSource(@Body() dto: CreateContentSourceDto) {
    return this.contentService.adminCreateSource(dto);
  }

  @Patch('sources/:id')
  updateSource(@Param('id') id: string, @Body() dto: Partial<CreateContentSourceDto>) {
    return this.contentService.adminUpdateSource(id, dto);
  }

  @Get('items')
  listItems(@Query() dto: ListContentItemsDto) {
    return this.contentService.adminListItems(dto);
  }

  @Post('items')
  createItem(@Body() dto: CreateContentItemDto) {
    return this.contentService.adminCreateItem(dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: Partial<CreateContentItemDto>) {
    return this.contentService.adminUpdateItem(id, dto);
  }

  @Post('sync')
  sync() {
    return this.contentService.adminSync();
  }

  @Post('clear-placeholder-images')
  clearPlaceholderImages() {
    return this.contentService.adminClearPlaceholderImages();
  }
}
