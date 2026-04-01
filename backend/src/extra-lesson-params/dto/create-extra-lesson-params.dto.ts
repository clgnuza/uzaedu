import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsDateString,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class LineItemDto {
  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsString()
  type!: 'hourly' | 'fixed';

  /** Gösterge: 140 (gündüz) veya 150 (gece). Formülden hesaplama için. */
  @IsOptional()
  @IsNumber()
  indicator?: number;

  /** Çarpan: 1 (normal), 1.25 (özel eğitim), 2 (DYK). */
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @IsOptional()
  @IsNumber()
  gosterge_day?: number;

  @IsOptional()
  @IsNumber()
  gosterge_night?: number;

  @IsOptional()
  @IsNumber()
  unit_price_day?: number;

  @IsOptional()
  @IsNumber()
  unit_price_night?: number;

  @IsOptional()
  @IsNumber()
  unit_price?: number;

  @IsOptional()
  @IsNumber()
  fixed_amount?: number;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

class TaxBracketDto {
  @IsNumber()
  max_matrah!: number;

  @IsNumber()
  rate_percent!: number;
}

class CentralExamRoleDto {
  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsNumber()
  fixed_amount?: number;

  @IsOptional()
  @IsNumber()
  indicator?: number;
}

class EducationLevelDto {
  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsNumber()
  unit_day!: number;

  @IsNumber()
  unit_night!: number;
}

export class CreateExtraLessonParamsDto {
  @IsString()
  @MaxLength(32)
  semester_code!: string;

  @IsString()
  @MaxLength(128)
  title!: string;

  /** Aylık katsayı (1,387871 vb.). Formülden hesaplama için. */
  @IsOptional()
  @IsNumber()
  monthly_coefficient?: number;

  /** Gündüz göstergesi. Default 140. */
  @IsOptional()
  @IsNumber()
  indicator_day?: number;

  /** Gece göstergesi. Default 150. */
  @IsOptional()
  @IsNumber()
  indicator_night?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  line_items?: LineItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxBracketDto)
  tax_brackets?: TaxBracketDto[];

  @IsOptional()
  @IsNumber()
  gv_exemption_max?: number;

  @IsOptional()
  @IsNumber()
  dv_exemption_max?: number;

  @IsOptional()
  @IsNumber()
  stamp_duty_rate?: number;

  /** Sözleşmeli/Ücretli: SGK+İşsizlik işçi payı (%, 5510). Örn: 14. */
  @IsOptional()
  @IsNumber()
  sgk_employee_rate?: number;

  /** Ücretli öğretmen birim ücret oranı (0-1). Örn: 0.725 = %72,5. */
  @IsOptional()
  @IsNumber()
  ucretli_unit_scale?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CentralExamRoleDto)
  central_exam_roles?: CentralExamRoleDto[];

  /** Öğrenim durumuna göre birim ücretler. Boşsa varsayılan (Lisans, Y.Lisans, Doktora). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationLevelDto)
  education_levels?: EducationLevelDto[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;
}
