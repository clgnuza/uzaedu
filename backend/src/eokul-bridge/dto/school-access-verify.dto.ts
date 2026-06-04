import { IsString, MinLength } from 'class-validator';

export class SchoolAccessVerifyDto {
  @IsString()
  @MinLength(6)
  code!: string;
}
