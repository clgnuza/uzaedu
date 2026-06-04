import { IsIn, IsOptional } from 'class-validator';
import type { OkulKoprusuTier } from '../okul-koprusu-license';

export class SchoolAccessRegenerateDto {
  @IsOptional()
  @IsIn(['free', 'paid'])
  tier?: OkulKoprusuTier;
}
