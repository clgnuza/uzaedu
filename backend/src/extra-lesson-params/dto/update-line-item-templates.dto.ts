import { IsArray, IsString, IsNumber, IsOptional, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class LineItemTemplateDto {
  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsString()
  @IsIn(['hourly', 'fixed'])
  type!: 'hourly' | 'fixed';

  @IsNumber()
  indicator_day!: number;

  @IsOptional()
  @IsNumber()
  indicator_night?: number | null;

  @IsNumber()
  sort_order!: number;
}

export class UpdateLineItemTemplatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemTemplateDto)
  templates!: LineItemTemplateDto[];
}
