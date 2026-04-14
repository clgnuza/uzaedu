import { IsString, IsOptional, IsIn, IsArray, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class SaveSettingsDto {
  @IsIn(['mock', 'meta', 'twilio', 'netgsm', 'custom'])
  provider: 'mock' | 'meta' | 'twilio' | 'netgsm' | 'custom';

  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsString() apiSecret?: string;
  @IsOptional() @IsString() phoneNumberId?: string;
  @IsOptional() @IsString() fromNumber?: string;
  @IsOptional() @IsString() apiEndpoint?: string;
  @IsBoolean() isActive: boolean;
}

export class TestConnectionDto {
  @IsString() testPhone: string;
}

export class CreateManualCampaignDto {
  @IsString() title: string;
  @IsArray() recipients: Array<{ name: string; phone: string; message: string }>;
}

export class CreateExcelCampaignDto {
  @IsString() title: string;
  @IsOptional() @IsString() template?: string;
  @IsOptional() @IsString() tarih?: string;
}

export class CreatePdfSplitCampaignDto {
  @IsString() title: string;
  @IsOptional() @IsString() template?: string;
  @IsInt() @Min(1) @Max(20) pagesPerStudent: number;
  @IsArray() recipients: Array<{ name: string; phone: string; studentName?: string; studentNumber?: string; className?: string }>;
}
