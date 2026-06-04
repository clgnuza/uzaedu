import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { OkulKoprusuTier } from '../okul-koprusu-license';

export class SchoolAccessPatchDto {
  @IsOptional()
  @IsIn(['free', 'paid'])
  tier?: OkulKoprusuTier;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
