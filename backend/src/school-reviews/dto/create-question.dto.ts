import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @MaxLength(500)
  question: string;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;
}
