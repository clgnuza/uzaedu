import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class WebauthnLoginOptionsDto {
  @IsEmail()
  email: string;

  @IsIn(['teacher', 'school'])
  portal: 'teacher' | 'school';
}

export class WebauthnLoginVerifyDto extends WebauthnLoginOptionsDto {
  @IsObject()
  response: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  remember_me?: boolean;
}

export class WebauthnRegisterVerifyDto {
  @IsObject()
  response: Record<string, unknown>;

  @IsOptional()
  name?: string;
}

export class WebauthnRenameCredentialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}
