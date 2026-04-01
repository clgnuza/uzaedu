import { IsOptional, IsIn, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
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

  /** Yalnız admin: sync kaynaklı ve GPT/kaynak metninden başvuru bitişi + sınav tarihleri çıkarılamamış taslaklar */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  missing_source_dates?: boolean;

  /** Yalnız admin: sınav tarihi (başlangıç/bitiş) kayıtta yok */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  missing_exam_date?: boolean;

  /** Yalnız admin: en az bir sınav tarihi alanı dolu (varsayılan liste; tarihsizleri hariç tut) */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  has_exam_date?: boolean;
}
