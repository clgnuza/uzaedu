import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class FirebaseTokenDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  id_token: string;
}
