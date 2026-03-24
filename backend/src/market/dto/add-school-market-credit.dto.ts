import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddSchoolMarketCreditDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  jeton?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ekders?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
