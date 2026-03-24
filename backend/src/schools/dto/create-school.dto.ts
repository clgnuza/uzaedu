import { IsString, IsOptional, IsEnum, IsInt, Min, MaxLength } from 'class-validator';
import { SchoolSegment, SchoolStatus, SchoolType } from '../../types/enums';

export class CreateSchoolDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(SchoolType)
  type: SchoolType;

  @IsEnum(SchoolSegment)
  segment: SchoolSegment;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  website_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  about_description?: string | null;

  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  teacher_limit?: number;
}
