import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';

export class ListReviewsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;
}
