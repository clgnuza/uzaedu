import { IsString, IsArray, IsUUID } from 'class-validator';

export class CreateStudentListDto {
  @IsString()
  name: string;

  @IsArray()
  @IsUUID('4', { each: true })
  studentIds: string[];
}
