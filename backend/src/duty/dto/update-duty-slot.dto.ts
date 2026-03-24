import { IsOptional, IsString, IsUUID, IsDateString, IsIn } from 'class-validator';

export class UpdateDutySlotDto {
  @IsOptional()
  @IsDateString()
  date?: string;

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

  @IsOptional()
  @IsUUID()
  user_id?: string;
}
