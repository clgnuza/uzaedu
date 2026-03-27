import { IsOptional, IsString, IsEnum, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SchoolStatus, SchoolType, SchoolSegment, SchoolTypeGroup } from '../../types/enums';
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

  /** Tek tür yerine kademe grubu (varsa `type` yok sayılır) */
  @IsOptional()
  @IsEnum(SchoolTypeGroup)
  type_group?: SchoolTypeGroup;

  @IsOptional()
  @IsEnum(SchoolSegment)
  segment?: SchoolSegment;

  /** Okul adında arama (içerir) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
