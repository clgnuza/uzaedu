import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RespondSwapDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  admin_note?: string;

  /** Admin, day_change veya coverage_swap taleplerinde öğretmeni kendisi seçebilir */
  @IsOptional()
  @IsUUID()
  proposed_user_id?: string;
}
