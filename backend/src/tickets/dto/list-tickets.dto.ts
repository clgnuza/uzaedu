import { IsOptional, IsString, IsIn, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dtos/pagination.dto';

export class ListTicketsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(['SCHOOL_SUPPORT', 'PLATFORM_SUPPORT'])
  target_type?: 'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT';

  @IsOptional()
  @IsString()
  @IsIn(['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  module_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;

  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsString()
  q?: string;

  /** Taleplerim (owned) vs Inbox (school_inbox) vs platform. school_admin için fark yaratır. */
  @IsOptional()
  @IsString()
  @IsIn(['owned', 'school_inbox', 'platform'])
  list_mode?: 'owned' | 'school_inbox' | 'platform';
}
