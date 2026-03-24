import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBilsemCalendarAssignmentDto {
  @IsUUID()
  bilsem_calendar_item_id: string;

  @IsUUID()
  user_id: string;

  @IsOptional()
  @IsString()
  gorev_tipi?: 'sorumlu' | 'yardimci';
}
