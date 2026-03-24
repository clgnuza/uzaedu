import { IsString, MaxLength } from 'class-validator';

export class UpdateQuestionDto {
  @IsString()
  @MaxLength(500)
  question: string;
}
