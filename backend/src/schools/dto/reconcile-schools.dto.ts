import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
  Matches,
} from 'class-validator';

/** Excel / MEB dışa aktarım satırı — doğrulama gevşek; servis normalize eder. */
export class ReconcileSourceSchoolDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  segment?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(/^\d{4,16}$/, { message: 'Kurum kodu 4–16 hane rakam olmalıdır.' })
  institution_code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string | null;

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
  @IsEmail()
  @MaxLength(256)
  institutional_email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  principal_name?: string | null;

  @IsOptional()
  @IsString()
  about_description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.floor(n) : undefined;
  })
  @IsInt()
  @Min(1)
  teacher_limit?: number;
}

export class ReconcilePreviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconcileSourceSchoolDto)
  schools!: ReconcileSourceSchoolDto[];
}

export class ReconcileApplyOptionsDto {
  @IsBoolean()
  create_new!: boolean;

  @IsBoolean()
  apply_updates!: boolean;

  /** Kaynak dosyada kurum kodu olmayan sistem okulları: askıya al */
  @IsOptional()
  @IsBoolean()
  mark_missing_in_source_askida?: boolean;
}

export class ReconcileApplyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconcileSourceSchoolDto)
  schools!: ReconcileSourceSchoolDto[];

  @ValidateNested()
  @Type(() => ReconcileApplyOptionsDto)
  options!: ReconcileApplyOptionsDto;
}
