import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateButterflyBuildingDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
