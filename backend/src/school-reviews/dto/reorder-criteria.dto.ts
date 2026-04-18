import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderCriteriaDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ordered_ids!: string[];
}
