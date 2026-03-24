import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';

export class ListAdminMessagesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;
}
