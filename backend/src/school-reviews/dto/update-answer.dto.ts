import { IsString, MaxLength } from 'class-validator';

export class UpdateAnswerDto {
  @IsString()
  @MaxLength(1000)
  answer: string;
}
