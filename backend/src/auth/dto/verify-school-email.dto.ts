import { IsString, MinLength, MaxLength } from 'class-validator';

export class VerifySchoolEmailDto {
  @IsString()
  @MinLength(32)
  @MaxLength(64)
  token!: string;
}
