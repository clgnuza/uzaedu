import { IsString, IsOptional, IsInt, IsBoolean, IsArray, MaxLength } from 'class-validator';

export class CreateContentChannelDto {
  @IsString()
  @MaxLength(64)
  key: string;

  @IsString()
  @MaxLength(128)
  label: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  source_ids?: string[];
}
