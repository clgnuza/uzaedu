import { Allow, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';

/** ValidationPipe + forbidNonWhitelisted; `input` parseCalcInput ile doğrulanır */
export class PreviewYollukBodyDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscal_year?: number;

  @Allow()
  input: unknown;
}

export class CreateYollukBodyDto {
  @IsUUID()
  teacher_user_id: string;

  @Allow()
  input: unknown;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsUUID()
  school_id?: string | null;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscal_year?: number;
}

export class PatchYollukBodyDto {
  @Allow()
  input: unknown;

  @IsOptional()
  @IsString()
  title?: string | null;
}

export class UpsertYollukSettingsDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  fiscal_year: number;

  @IsNumber()
  @Min(0)
  default_daily_tl: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  km_daily_fraction?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  memur_fixed_multiplier?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  aile_per_multiplier?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  aile_fixed_cap_multiplier?: number;

  @IsOptional()
  @IsString()
  rules_version?: string;

  /** Kadro 1–15 → TL (JSON: { "1": 860, "5": 850, ... }); null = kod + yedek gündelik */
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsObject()
  derece_rates_json?: Record<string, number> | null;

  /** Ek gösterge bantları → TL: g8000_ust, g6400_8000, g3600_6400, alt3600 */
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsObject()
  ek_gosterge_rates_json?: Record<string, number> | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(366)
  denetim_mission_day_cap?: number;
}
