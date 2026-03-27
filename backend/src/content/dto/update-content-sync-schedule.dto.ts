import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateContentSyncScheduleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(10080)
  interval_minutes?: number;
}
