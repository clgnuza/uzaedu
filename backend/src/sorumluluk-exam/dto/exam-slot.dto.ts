import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class ExamSlotItemDto {
  @IsOptional() @IsString()
  id?: string;

  @IsString()
  sessionDate: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional() @IsString() @MaxLength(100)
  roomName?: string;

  @IsOptional() @IsInt() @Min(1)
  capacity?: number;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsString() @MaxLength(120)
  label?: string;
}

export class ReplaceExamSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamSlotItemDto)
  slots: ExamSlotItemDto[];
}
