import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  IsNumber,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

class ScanAnswerDto {
  @IsNumber()
  question: number;

  @IsString()
  label: string;
}

export class CreateOptikScanResultDto {
  @IsUUID()
  template_id: string;

  @IsString()
  template_name: string;

  @IsIn(['mc', 'open'])
  kind: 'mc' | 'open';

  @IsOptional()
  @IsString()
  exam_type?: string;

  @IsOptional()
  @IsUUID()
  class_id?: string;

  @IsOptional()
  @IsString()
  class_name?: string;

  @IsOptional()
  @IsUUID()
  subject_id?: string;

  @IsOptional()
  @IsString()
  subject_name?: string;

  @IsOptional()
  @IsUUID()
  session_id?: string;

  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsOptional()
  @IsString()
  student_label?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanAnswerDto)
  answers?: ScanAnswerDto[];

  @IsOptional()
  @IsNumber()
  ambiguous_count?: number;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsNumber()
  anchor_score?: number;

  @IsOptional()
  @IsNumber()
  grade_score?: number;

  @IsOptional()
  @IsNumber()
  grade_max_score?: number;

  @IsOptional()
  @IsString()
  grade_mode?: string;

  @IsOptional()
  @IsNumber()
  correct_count?: number;

  @IsOptional()
  @IsNumber()
  wrong_count?: number;

  @IsOptional()
  @IsNumber()
  blank_count?: number;

  @IsOptional()
  @IsNumber()
  net_score?: number;

  @IsOptional()
  open_grades?: Array<{ question_id: string; score: number; max_score: number }>;
}
