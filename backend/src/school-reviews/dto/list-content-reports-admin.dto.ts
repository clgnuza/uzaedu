import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';

/** GET /school-reviews/content-reports/admin — süper yönetici / moderatör bildirim kuyruğu */
export class ListContentReportsAdminDto extends PaginationDto {
  @IsOptional()
  @IsIn(['review', 'question', 'answer'])
  entity_type?: 'review' | 'question' | 'answer';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reason?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unread_only?: boolean;
}
