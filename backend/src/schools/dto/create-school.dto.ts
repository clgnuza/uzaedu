import { IsString, IsOptional, IsEnum, IsInt, Min, MaxLength, Matches, ValidateIf, IsEmail } from 'class-validator';
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
  @MaxLength(32)
  fax?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(/^\d{4,16}$/, { message: 'MEB kurum kodu yalnızca rakam ve 4–16 hane olmalıdır.' })
  institution_code?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail({}, { message: 'Geçerli bir e-posta girin.' })
  @MaxLength(256)
  institutional_email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  principal_name?: string | null;

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
