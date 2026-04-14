import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProctorRowDto {
  @IsUUID()
  room_id: string;

  @IsUUID()
  user_id: string;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class SetButterflyProctorsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ProctorRowDto)
  proctors: ProctorRowDto[];
}
