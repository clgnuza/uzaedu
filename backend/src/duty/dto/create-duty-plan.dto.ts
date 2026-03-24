import { IsOptional, IsString, IsArray, IsUUID, IsDateString, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class DutySlotInputDto {
  @IsDateString()
  date: string;

  /** morning | afternoon */
  @IsOptional()
  @IsIn(['morning', 'afternoon'])
  shift?: 'morning' | 'afternoon';

  @IsOptional()
  @IsString()
  slot_name?: string | null;

  @IsOptional()
  @IsString()
  area_name?: string | null;

  @IsOptional()
  @IsString()
  slot_start_time?: string | null;

  @IsOptional()
  @IsString()
  slot_end_time?: string | null;

  @IsUUID()
  user_id: string;
}

export class CreateDutyPlanDto {
  @IsOptional()
  @IsString()
  version?: string | null;

  @IsOptional()
  @IsDateString()
  period_start?: string | null;

  @IsOptional()
  @IsDateString()
  period_end?: string | null;

  @IsOptional()
  @IsString()
  academic_year?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DutySlotInputDto)
  slots: DutySlotInputDto[];
}
