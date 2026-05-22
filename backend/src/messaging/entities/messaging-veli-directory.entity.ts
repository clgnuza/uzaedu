import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('messaging_veli_directory')
export class MessagingVeliDirectory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 255, nullable: true })
  contactName: string | null;

  @Column({ name: 'student_name', type: 'varchar', length: 255, nullable: true })
  studentName: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 50, nullable: true })
  className: string | null;

  @Column({ name: 'student_number', type: 'varchar', length: 50, nullable: true })
  studentNumber: string | null;

  @Column({ type: 'varchar', length: 30, default: 'import' })
  source: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
