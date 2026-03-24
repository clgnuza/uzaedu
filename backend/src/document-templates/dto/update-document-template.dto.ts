import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsIn,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const FORMATS = ['docx', 'xlsx', 'pdf'] as const;

class FormSchemaItemDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class UpdateDocumentTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sub_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  school_type?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  subject_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  subject_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  curriculum_model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  academic_year?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  file_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  file_url_local?: string;

  @IsOptional()
  @IsString()
  @IsIn(FORMATS)
  file_format?: (typeof FORMATS)[number];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_merge?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormSchemaItemDto)
  form_schema?: FormSchemaItemDto[];

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
