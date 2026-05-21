import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserFormTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  formType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  questionCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  choiceCount?: number;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  examType?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string | null;

  @IsOptional()
  @IsString()
  subjectHint?: string | null;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateUserFormTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  formType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  questionCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  choiceCount?: number;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  examType?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string | null;

  @IsOptional()
  @IsString()
  subjectHint?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
