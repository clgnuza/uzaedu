import { IsString } from 'class-validator';

export class FirebaseTokenDto {
  @IsString()
  id_token: string;
}
