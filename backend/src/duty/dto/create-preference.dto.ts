import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePreferenceDto {
  /** Tek gün modu – YYYY-MM-DD */
  @IsOptional()
  @IsString()
  date?: string;

  /** Her hafta modu – 1=Pazartesi .. 6=Cumartesi */
  @IsOptional()
  @IsArray()
  day_of_week?: number[];

  @IsOptional()
  @IsString()
  period_from?: string;

  @IsOptional()
  @IsString()
  period_to?: string;

  @IsIn(['available', 'unavailable', 'prefer'])
  status: 'available' | 'unavailable' | 'prefer';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
