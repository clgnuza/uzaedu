import { IsArray, IsUUID } from 'class-validator';

export class ReorderBilsemCalendarItemsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  item_ids: string[];
}
