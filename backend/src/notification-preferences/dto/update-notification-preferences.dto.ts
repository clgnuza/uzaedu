import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NOTIFICATION_CHANNELS } from '../../notifications/notification-channels';

const CHANNEL_IDS = NOTIFICATION_CHANNELS.map((c) => c.id);

export class ChannelPrefDto {
  @IsString()
  @MaxLength(64)
  @IsIn(CHANNEL_IDS)
  channel: string;

  @IsOptional()
  @IsBoolean()
  push_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  critical?: boolean;
}

export class PushSettingsDto {
  @IsOptional()
  @IsBoolean()
  quiet_hours_enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  quiet_start_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  quiet_end_minutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  sound_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  vibration_enabled?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelPrefDto)
  channels?: ChannelPrefDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PushSettingsDto)
  settings?: PushSettingsDto;
}
