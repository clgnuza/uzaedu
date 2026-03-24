import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { EXAM_DUTY_CATEGORIES } from '../entities/exam-duty.entity';

export class ListExamDutiesDto extends PaginationDto {
  /** Filtre: sadece bu kategorideki duyurular */
  @IsOptional()
  @IsIn(EXAM_DUTY_CATEGORIES)
  category_slug?: string;

  /** Filtre: draft | published. Teacher için sadece published gelir. */
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;

  /** Geçmiş duyuruları gizle (exam_date_end < bugün-30). Varsayılan: true (öğretmen için) */
  @IsOptional()
  hide_past?: boolean;
}
