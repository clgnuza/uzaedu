import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsNumber,
  IsIn,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GradeOpenItemDto {
  @IsString()
  question_id: string;

  @IsString()
  student_text: string;

  @IsOptional()
  @IsIn(['CONTENT', 'LANGUAGE', 'CONTENT_LANGUAGE', 'MATH_FINAL', 'MATH_STEPS'])
  mode?: 'CONTENT' | 'LANGUAGE' | 'CONTENT_LANGUAGE' | 'MATH_FINAL' | 'MATH_STEPS';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  max_score?: number;
}

export class GradeSessionOpenDto {
  @IsUUID()
  student_id: string;

  @IsOptional()
  @IsString()
  student_label?: string;

  @IsString()
  key_text: string;

  @IsOptional()
  @IsNumber()
  ocr_confidence?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeOpenItemDto)
  items: GradeOpenItemDto[];
}

export class ManualOpenScoreItemDto {
  @IsString()
  question_id: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(1)
  max_score: number;
}

export class ManualOpenScoresDto {
  @IsUUID()
  student_id: string;

  @IsOptional()
  @IsString()
  student_label?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualOpenScoreItemDto)
  grades: ManualOpenScoreItemDto[];
}
