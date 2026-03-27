import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AppConfigService } from '../app-config/app-config.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

class ListMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

function toScope(payload: CurrentUserPayload) {
  return {
    role: payload.user.role as UserRole,
    schoolId: payload.schoolId ?? null,
    userId: payload.userId,
    moderatorModules: payload.user.moderatorModules ?? undefined,
  };
}

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly appConfigService: AppConfigService,
  ) {}

  private async ensureSupportEnabled(payload: CurrentUserPayload): Promise<void> {
    if (payload.user.role === UserRole.superadmin) return;
    const webExtras = await this.appConfigService.getWebExtrasConfig();
    if (webExtras.support_enabled) return;
    throw new ForbiddenException({
      code: 'MODULE_DISABLED',
      message: 'Destek modülü şu anda kapalı.',
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async create(@Body() dto: CreateTicketDto, @CurrentUser() payload: CurrentUserPayload) {
    await this.ensureSupportEnabled(payload);
    return this.ticketsService.create(dto, toScope(payload));
  }

  @Get('assignable-users')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async getAssignableUsers(
    @Query('school_id') schoolId: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.ensureSupportEnabled(payload);
    if (payload.user.role === UserRole.moderator && !(payload.user.moderatorModules ?? []).includes('support')) {
      throw new (await import('@nestjs/common').then((m) => m.ForbiddenException))({
        code: 'FORBIDDEN',
        message: 'Destek modülü yetkiniz yok.',
      });
    }
    return this.ticketsService.getAssignableUsers(toScope(payload), schoolId ?? undefined);
  }

  @Get('modules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async getModules(
    @Query('target_type') targetType: 'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT' | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.ensureSupportEnabled(payload);
    return this.ticketsService.getModules(targetType);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async list(@Query() dto: ListTicketsDto, @CurrentUser() payload: CurrentUserPayload) {
    await this.ensureSupportEnabled(payload);
    if (payload.user.role === UserRole.moderator) {
      if (!(payload.user.moderatorModules ?? []).includes('support')) {
        return { total: 0, page: dto.page ?? 1, limit: dto.limit ?? 20, items: [] };
      }
    }
    return this.ticketsService.list(dto, toScope(payload));
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.ensureSupportEnabled(payload);
    if (payload.user.role === UserRole.moderator && !(payload.user.moderatorModules ?? []).includes('support')) {
      throw new (await import('@nestjs/common').then((m) => m.ForbiddenException))({
        code: 'FORBIDDEN',
        message: 'Destek modülü yetkiniz yok.',
      });
    }
    return this.ticketsService.findById(id, toScope(payload));
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.ensureSupportEnabled(payload);
    if (payload.user.role === UserRole.moderator && !(payload.user.moderatorModules ?? []).includes('support')) {
      throw new (await import('@nestjs/common').then((m) => m.ForbiddenException))({
        code: 'FORBIDDEN',
        message: 'Destek modülü yetkiniz yok.',
      });
    }
    return this.ticketsService.update(id, dto, toScope(payload));
  }

  @Post(':id/escalate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateTicketDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.ensureSupportEnabled(payload);
    return this.ticketsService.escalate(
      id,
      dto.reason,
      dto.extra_info,
      toScope(payload),
    );
  }

  @Post(':id/messages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.ensureSupportEnabled(payload);
    if (payload.user.role === UserRole.moderator && !(payload.user.moderatorModules ?? []).includes('support')) {
      throw new (await import('@nestjs/common').then((m) => m.ForbiddenException))({
        code: 'FORBIDDEN',
        message: 'Destek modülü yetkiniz yok.',
      });
    }
    return this.ticketsService.addMessage(id, dto, toScope(payload));
  }

  @Get(':id/messages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.moderator, UserRole.superadmin)
  async listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListMessagesDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.ensureSupportEnabled(payload);
    if (payload.user.role === UserRole.moderator && !(payload.user.moderatorModules ?? []).includes('support')) {
      throw new (await import('@nestjs/common').then((m) => m.ForbiddenException))({
        code: 'FORBIDDEN',
        message: 'Destek modülü yetkiniz yok.',
      });
    }
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    return this.ticketsService.listMessages(id, page, limit, toScope(payload));
  }
}
