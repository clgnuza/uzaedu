import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  @MaxLength(1000)
  answer: string;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;
}
