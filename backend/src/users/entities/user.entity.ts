import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserRole, UserStatus, TeacherSchoolMembershipStatus } from '../../types/enums';
import { School } from '../../schools/entities/school.entity';

/** Evrak formunda varsayılan değerler (profil ayarlarından) */
export interface EvrakDefaults {
  okul_adi?: string;
  mudur_adi?: string;
  ogretim_yili?: string;
  sinif?: string;
  zumreler?: string;
  zumre_ogretmenleri?: string;
  /** İmza/onay tarihi; boşsa bugün kullanılır */
  onay_tarihi?: string;
  /** Öğretmen unvanı / branş – imza alanında isim altında (örn. "Coğrafya Öğretmeni"); boşsa ders adı veya user.teacherBranch kullanılır */
  ogretmen_unvani?: string;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  display_name: string | null;

  @Column({ type: 'varchar', length: 32 })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  school_id: string | null;

  /** Okul seçimi / admin onayı (none + school_id dolu eski kayıtlar API’de approved sayılır) */
  @Column({
    name: 'teacher_school_membership',
    type: 'varchar',
    length: 24,
    default: TeacherSchoolMembershipStatus.none,
  })
  teacherSchoolMembership: TeacherSchoolMembershipStatus;

  /** Diğer öğretmenlere tam ad yerine maskeli gösterim */
  @Column({ name: 'teacher_public_name_masked', type: 'boolean', default: true })
  teacherPublicNameMasked: boolean;

  @Column({ type: 'varchar', length: 32, default: UserStatus.active })
  status: UserStatus;

  /** Firebase Auth uid; token doğrulama sonrası eşleşme için */
  @Column({ name: 'firebase_uid', type: 'varchar', length: 128, unique: true, nullable: true })
  firebaseUid: string | null;

  /** Yerel/demo giriş için bcrypt hash (opsiyonel) */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  /** Öğretmen branşı (örn. Matematik, Türkçe) */
  @Column({ name: 'teacher_branch', type: 'varchar', length: 100, nullable: true })
  teacherBranch: string | null;

  /** Öğretmen iletişim telefonu */
  @Column({ name: 'teacher_phone', type: 'varchar', length: 32, nullable: true })
  teacherPhone: string | null;

  /** Öğretmen ünvanı (örn. Kadrolu, Sözleşmeli) */
  @Column({ name: 'teacher_title', type: 'varchar', length: 64, nullable: true })
  teacherTitle: string | null;

  /** Profil fotoğrafı URL */
  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true })
  avatarUrl: string | null;

  /** Hazır profil görseli (SVG/Lightweight; avatar_url ile birlikte kullanılmazsa öncelik verilebilir) */
  @Column({ name: 'avatar_key', type: 'varchar', length: 32, nullable: true })
  avatarKey: string | null;

  /** Okuttuğu ders ID listesi (SchoolSubject id'leri, JSON array) */
  @Column({ name: 'teacher_subject_ids', type: 'jsonb', nullable: true })
  teacherSubjectIds: string[] | null;

  /** Moderator için yetkili modüller (sadece role=moderator ise anlamlı) */
  @Column({ name: 'moderator_modules', type: 'jsonb', nullable: true })
  moderatorModules: string[] | null;

  /**
   * MEB Ortaöğretim Kurumları Yönetmeliği Madde 91: Nöbetten muaf öğretmenler.
   * Müdür, müdür yardımcısı, hamile, engelli vb. kategoriler için admin işaretler.
   * Otomatik nöbet planlamasında ve önerilerde bu kullanıcılar atlanır.
   */
  @Column({ name: 'duty_exempt', type: 'boolean', default: false })
  dutyExempt: boolean;

  /** Nöbet muafiyet nedeni (isteğe bağlı açıklama) */
  @Column({ name: 'duty_exempt_reason', type: 'varchar', length: 128, nullable: true })
  dutyExemptReason: string | null;

  /** Evrak formunda varsayılan olarak doldurulacak alanlar (profil ayarlarından) */
  @Column({ name: 'evrak_defaults', type: 'jsonb', nullable: true })
  evrakDefaults: EvrakDefaults | null;

  /** Market: bireysel jeton bakiyesi */
  @Column({ name: 'market_jeton_balance', type: 'numeric', precision: 14, scale: 6, default: 0 })
  marketJetonBalance: string;

  /** Market: bireysel ek ders bakiyesi */
  @Column({ name: 'market_ekders_balance', type: 'numeric', precision: 14, scale: 6, default: 0 })
  marketEkdersBalance: string;

  /** Okul kaydı: e-postadaki doğrulama bağlantısı için tek seferlik anahtar */
  @Column({ name: 'school_join_email_token', type: 'varchar', length: 64, nullable: true })
  schoolJoinEmailToken: string | null;

  @Column({ name: 'school_join_email_token_expires_at', type: 'timestamptz', nullable: true })
  schoolJoinEmailTokenExpiresAt: Date | null;

  /** Kurumsal adres tıklanı ile doğrulandı (sonra süperadmin onayı) */
  @Column({ name: 'school_join_email_verified_at', type: 'timestamptz', nullable: true })
  schoolJoinEmailVerifiedAt: Date | null;

  /** E-posta ile kayıt: OTP doğrulaması sonrası dolu (sosyal/Firebase’de otomatik) */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** E-posta+şifre girişinde doğrulama kodu (varsayılan açık; profilden kapatılabilir) */
  @Column({ name: 'login_otp_required', type: 'boolean', default: true })
  loginOtpRequired: boolean;

  /** USB / tahta: sınıf TV ekranı için öğretmene özel PIN (bcrypt); idare atar. */
  @Column({ name: 'smart_board_usb_pin_hash', type: 'varchar', length: 255, nullable: true })
  smartBoardUsbPinHash: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => School, (s) => s.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'school_id' })
  school: School | null;
}
