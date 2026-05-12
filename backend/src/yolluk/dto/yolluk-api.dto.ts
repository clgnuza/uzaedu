import { Allow, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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

  /** Kadro 1–15 → TL (JSON: { "1": 71, "5": 62, ... }) */
  @IsOptional()
  @IsObject()
  derece_rates_json?: Record<string, number> | null;
}
