import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PreviewDraftFromPasteDto {
  @IsString()
  subject_code!: string;

  @IsString()
  subject_label!: string;

  /** Takvim / ders saati / kazanım kapsaması için (Bilsem’de DB’ye yazılmaz). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade!: number;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  school_profile?: string;

  @IsString()
  academic_year!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  @MaxLength(600000)
  payload!: string;

  /** structured: JSON/CSV/kazanim_plan doğrudan; gpt: yapıştırılan tam metinden GPT üretir */
  @IsOptional()
  @IsIn(['structured', 'gpt'])
  paste_mode?: 'structured' | 'gpt';

  @IsOptional()
  @IsString()
  curriculum_model?: string;

  @IsOptional()
  @IsString()
  ana_grup?: string;

  @IsOptional()
  @IsString()
  alt_grup?: string;
}
