import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
  Matches,
} from 'class-validator';

function stripAndSlice(v: unknown, max: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).replace(/\0/g, '').trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

/** MEB regex yakalaması bazen RFC dışı kalır; reconcile isteğini kırmamak için gevşek kontrol. */
function sanitizeInstitutionalEmail(v: unknown): string | undefined {
  const s = stripAndSlice(v, 256);
  if (!s) return undefined;
  if (!/^[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+$/i.test(s)) return undefined;
  return s;
}

/** Excel / MEB dışa aktarım satırı — doğrulama gevşek; servis normalize eder. */
export class ReconcileSourceSchoolDto {
  @Transform(({ value }) => {
    if (value == null) return '';
    return String(value).replace(/\0/g, '').trim().slice(0, 255);
  })
  @IsString()
  @MinLength(1, { message: 'Okul adı gerekli.' })
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 32))
  @IsString()
  @MaxLength(32)
  type?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 32))
  @IsString()
  @MaxLength(32)
  segment?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 100))
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 100))
  @IsString()
  @MaxLength(100)
  district?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const digits = String(value).trim().replace(/\D/g, '');
    return /^\d{4,16}$/.test(digits) ? digits : undefined;
  })
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(/^\d{4,16}$/, { message: 'Kurum kodu 4–16 hane rakam olmalıdır.' })
  institution_code?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 512))
  @IsString()
  @MaxLength(512)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 1024))
  @IsString()
  @MaxLength(1024)
  map_url?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 512))
  @IsString()
  @MaxLength(512)
  school_image_url?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 512))
  @IsString()
  @MaxLength(512)
  website_url?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 32))
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 32))
  @IsString()
  @MaxLength(32)
  fax?: string | null;

  @IsOptional()
  @Transform(({ value }) => sanitizeInstitutionalEmail(value))
  @IsString()
  @MaxLength(256)
  institutional_email?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 128))
  @IsString()
  @MaxLength(128)
  principal_name?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 32000))
  @IsString()
  about_description?: string | null;

  @IsOptional()
  @Transform(({ value }) => stripAndSlice(value, 32))
  @IsString()
  @MaxLength(32)
  status?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    const f = Math.floor(n);
    return f >= 1 ? f : undefined;
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
