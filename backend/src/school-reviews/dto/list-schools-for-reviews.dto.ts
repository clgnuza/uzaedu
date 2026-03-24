import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { SchoolType, SchoolSegment } from '../../types/enums';

/** GET /school-reviews/schools – Okul listesi (arama/filtre). Teacher ve superadmin. */
export class ListSchoolsForReviewsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsEnum(SchoolType)
  type?: SchoolType;

  @IsOptional()
  @IsEnum(SchoolSegment)
  segment?: SchoolSegment;

  /** Okul adında arama. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
