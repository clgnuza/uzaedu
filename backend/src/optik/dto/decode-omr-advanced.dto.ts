import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

export class DecodeOmrAdvancedDto {
  @IsString()
  @IsNotEmpty()
  image!: string;

  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @IsNumber()
  @IsOptional()
  maxQuestion?: number;
}
