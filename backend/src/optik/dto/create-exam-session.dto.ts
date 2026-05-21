import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  IsIn,
  IsObject,
  Min,
  Max,
  IsArray,
} from 'class-validator';

export class CreateExamSessionDto {
  @IsString()
  title: string;

  @IsUUID()
  template_id: string;

  @IsString()
  template_name: string;

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
  @IsInt()
  @Min(1)
  @Max(200)
  question_count?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  choice_count?: number;

  @IsOptional()
  @IsIn(['standard', 'penalty_4_1'])
  scoring_mode?: 'standard' | 'penalty_4_1';

  @IsOptional()
  @IsString()
  exam_date?: string;

  @IsOptional()
  @IsUUID()
  butterfly_plan_id?: string;

  @IsOptional()
  @IsString()
  outcome_plan_key?: string;
}

export class UpdateAnswerKeyDto {
  @IsObject()
  answer_key: Record<string, string>;

  @IsOptional()
  @IsIn(['standard', 'penalty_4_1'])
  scoring_mode?: 'standard' | 'penalty_4_1';
}

export class UpdateOpenQuestionsDto {
  @IsArray()
  open_questions: Array<{ id: string; title: string; max_score: number; mode?: string; key_text?: string }>;
}
