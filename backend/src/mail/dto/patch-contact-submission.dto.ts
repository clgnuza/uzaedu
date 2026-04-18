import { IsIn } from 'class-validator';

/** Yanıt yalnız POST /reply ile; burada sadece arşiv / yeniden açma */
export class PatchContactSubmissionDto {
  @IsIn(['new', 'archived'])
  status: 'new' | 'archived';
}
