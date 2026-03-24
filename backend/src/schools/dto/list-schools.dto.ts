import { IsOptional, IsString, IsEnum, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SchoolStatus, SchoolType, SchoolSegment } from '../../types/enums';
import { PaginationDto } from '../../common/dtos/pagination.dto';

/** GET /schools query params. Superadmin için filtreler. Modüller sayfası için limit=500'e izin. */
export class ListSchoolsDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;

  @IsOptional()
  @IsEnum(SchoolType)
  type?: SchoolType;

  @IsOptional()
  @IsEnum(SchoolSegment)
  segment?: SchoolSegment;

  /** Okul adında arama (içerir) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
