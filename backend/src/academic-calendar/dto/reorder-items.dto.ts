import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class ReorderAcademicCalendarItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  item_ids: string[];
}
