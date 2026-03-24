import { IsString, IsNumber, IsIn, IsOptional } from 'class-validator';

export class GradeRequestDto {
  @IsString()
  template_id: string;

  @IsString()
  question_id: string;

  @IsIn(['CONTENT', 'LANGUAGE', 'CONTENT_LANGUAGE', 'MATH_FINAL', 'MATH_STEPS'])
  mode: 'CONTENT' | 'LANGUAGE' | 'CONTENT_LANGUAGE' | 'MATH_FINAL' | 'MATH_STEPS';

  @IsNumber()
  max_score: number;

  @IsString()
  key_text: string;

  @IsString()
  student_text: string;

  @IsNumber()
  ocr_confidence: number;

  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';

  @IsOptional()
  @IsString()
  subject?: string;
}
