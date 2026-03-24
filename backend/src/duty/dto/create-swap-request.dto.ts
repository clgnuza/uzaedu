import { IsUUID, IsOptional, IsIn } from 'class-validator';

export class CreateSwapRequestDto {
  @IsUUID()
  duty_slot_id: string;

  /** 'swap': nöbet günü takas (proposed_user_id zorunlu), 'day_change': serbest gün değişimi, 'coverage_swap': ders görevi değişimi */
  @IsOptional()
  @IsIn(['swap', 'day_change', 'coverage_swap'])
  request_type?: 'swap' | 'day_change' | 'coverage_swap';

  @IsOptional()
  @IsUUID()
  proposed_user_id?: string;

  /** coverage_swap tipinde hangi ders görevi (DutyCoverage.id) değiştirilmek isteniyor */
  @IsOptional()
  @IsUUID()
  coverage_id?: string;
}
