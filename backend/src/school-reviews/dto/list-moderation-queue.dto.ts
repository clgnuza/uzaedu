import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';

/** GET /school-reviews/moderation/queue — bekleyen içerik kuyruğu */
export class ListModerationQueueDto extends PaginationDto {
  @IsOptional()
  @IsIn(['review', 'question', 'answer'])
  entity_type?: 'review' | 'question' | 'answer';
}
