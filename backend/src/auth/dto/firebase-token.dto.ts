import { IsNotEmpty, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class FirebaseTokenDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  id_token: string;

  @IsOptional()
  @IsBoolean()
  remember_me?: boolean;
}
