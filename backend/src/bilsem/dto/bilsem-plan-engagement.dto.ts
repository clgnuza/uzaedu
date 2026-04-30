import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class BilsemPlanEngagementCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
