import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';

/** GET /announcements query. Superadmin için school_id zorunlu. */
export class ListAnnouncementsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;
}
