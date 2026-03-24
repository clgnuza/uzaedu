import { IsArray, IsDateString, IsIn, IsUUID, ArrayMinSize } from 'class-validator';

const DATE_FIELDS = [
  'application_start',
  'application_end',
  'application_approval_end',
  'result_date',
  'exam_date',
  'exam_date_end',
] as const;

export class BulkUpdateDatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsIn(DATE_FIELDS)
  field!: (typeof DATE_FIELDS)[number];

  @IsDateString()
  value!: string;
}
