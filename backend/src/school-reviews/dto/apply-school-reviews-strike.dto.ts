import { IsUUID } from 'class-validator';

/** POST /school-reviews/content-reports/admin/penalties/strike — içerik yazarına ceza (süper yönetici) */
export class ApplySchoolReviewsStrikeDto {
  @IsUUID('4')
  user_id: string;
}
