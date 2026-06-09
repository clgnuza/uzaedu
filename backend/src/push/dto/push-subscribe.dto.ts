import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class SubscribeBodyDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class UnsubscribeBodyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  endpoint?: string;
}
