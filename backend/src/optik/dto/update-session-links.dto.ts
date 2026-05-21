import { IsString, IsUUID, IsOptional, IsObject } from 'class-validator';

export class UpdateSessionLinksDto {
  @IsOptional()
  @IsUUID()
  butterfly_plan_id?: string | null;

  @IsOptional()
  @IsString()
  outcome_plan_key?: string | null;
}

export class UpdateQuestionOutcomesDto {
  @IsObject()
  question_outcomes: Record<
    string,
    { label: string; plan_item_id?: string; week_order?: number; konu?: string }
  >;
}
