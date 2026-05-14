import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('dt_school_procurement_settings')
export class DtSchoolProcurementSettings {
  @PrimaryColumn({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ name: 'header_line2', type: 'varchar', length: 512, nullable: true })
  headerLine2: string | null;

  @Column({ name: 'header_line3', type: 'varchar', length: 512, nullable: true })
  headerLine3: string | null;

  @Column({ name: 'header_line4', type: 'varchar', length: 512, nullable: true })
  headerLine4: string | null;

  @Column({ name: 'spending_authority_name', type: 'varchar', length: 256, nullable: true })
  spendingAuthorityName: string | null;

  @Column({ name: 'spending_authority_title', type: 'varchar', length: 128, nullable: true })
  spendingAuthorityTitle: string | null;

  @Column({ name: 'realization_authority_name', type: 'varchar', length: 256, nullable: true })
  realizationAuthorityName: string | null;

  @Column({ name: 'realization_authority_title', type: 'varchar', length: 128, nullable: true })
  realizationAuthorityTitle: string | null;

  @Column({ name: 'official_correspondence_code', type: 'varchar', length: 64, nullable: true })
  officialCorrespondenceCode: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
