import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { SmartBoardDevice } from './entities/smart-board-device.entity';
import { SmartBoardDeviceSchedule } from './entities/smart-board-device-schedule.entity';
import { SmartBoardAuthorizedTeacher } from './entities/smart-board-authorized-teacher.entity';
import { SmartBoardSession } from './entities/smart-board-session.entity';
import { TvClassroomUsbToken } from './entities/tv-classroom-usb-token.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, UserStatus } from '../types/enums';
import { SchoolsService } from '../schools/schools.service';
import { AuditService } from '../audit/audit.service';
import { TeacherTimetableService } from '../teacher-timetable/teacher-timetable.service';
import { NotificationsService } from '../notifications/notifications.service';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 dakika
const TV_USB_TOKEN_TTL_MS = 10 * 60 * 60 * 1000; // 10 saat (okul günü)
const USB_PIN_PATTERN = /^\d{4,8}$/;

@Injectable()
export class SmartBoardService {
  private readonly usbUnlockFailTs = new Map<string, number[]>();

  constructor(
    @InjectRepository(SmartBoardDevice)
    private readonly deviceRepo: Repository<SmartBoardDevice>,
    @InjectRepository(SmartBoardDeviceSchedule)
    private readonly scheduleRepo: Repository<SmartBoardDeviceSchedule>,
    @InjectRepository(SmartBoardAuthorizedTeacher)
    private readonly authRepo: Repository<SmartBoardAuthorizedTeacher>,
    @InjectRepository(SmartBoardSession)
    private readonly sessionRepo: Repository<SmartBoardSession>,
    @InjectRepository(TvClassroomUsbToken)
    private readonly tvUsbTokenRepo: Repository<TvClassroomUsbToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly schoolsService: SchoolsService,
    private readonly auditService: AuditService,
    private readonly timetableService: TeacherTimetableService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isModuleEnabled(school: { enabled_modules: string[] | null }): boolean {
    const mods = school.enabled_modules;
    return !mods || mods.length === 0 || mods.includes('smart_board');
  }

  async getStatus(
    userId: string,
    schoolId: string | null,
    role: UserRole,
  ): Promise<{ enabled: boolean; authorized: boolean; mySession?: { session_id: string; device_id: string; device_name: string }; myClassSections?: string[] }> {
    if (role !== UserRole.teacher) {
      return { enabled: true, authorized: true };
    }
    if (!schoolId) return { enabled: false, authorized: false };
    const school = await this.schoolsService.findById(schoolId);
    const enabled = this.isModuleEnabled(school);
    if (!enabled) return { enabled: false, authorized: false };
    const autoAuthorize = school.smartBoardAutoAuthorize ?? false;
    let authorized = false;
    if (autoAuthorize) {
      authorized = true;
    } else {
      const auth = await this.authRepo.findOne({
        where: { school_id: schoolId, user_id: userId },
      });
      authorized = !!auth;
    }
    const result: { enabled: boolean; authorized: boolean; mySession?: { session_id: string; device_id: string; device_name: string }; myClassSections?: string[] } = {
      enabled: true,
      authorized,
    };
    if (authorized) {
      const activeSession = await this.sessionRepo.findOne({
        where: { user_id: userId, disconnected_at: IsNull() },
        relations: ['device'],
      });
      if (activeSession?.device) {
        result.mySession = {
          session_id: activeSession.id,
          device_id: activeSession.device_id,
          device_name: activeSession.device.name,
        };
      }
      const teacherClasses = await this.timetableService.getClassSectionsForTeacher(schoolId, userId);
      if (teacherClasses.length > 0) result.myClassSections = teacherClasses;
    }
    return result;
  }

  /** Türkiye saati: Pazartesi=1, Cuma=5. Pazar=0 için okul yok. */
  private getDayOfWeekTR(now: Date): number {
    const n = now.getDay(); // 0=Pazar, 1=Pzt, ..., 6=Cmt
    return n === 0 ? 0 : n;
  }

  /** Ders saati formatı "HH:mm" -> dakika (00:00'dan itibaren). */
  private parseTimeToMinutes(t: string): number {
    const [h, m] = (t || '').split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  /** Cmt (6) ve Pazar (0): lesson_schedule_weekend doluysa onu, değilse lesson_schedule. */
  private getEffectiveLessonSchedule(
    school: {
      lesson_schedule?: { lesson_num: number; start_time: string; end_time: string }[] | null;
      lesson_schedule_weekend?: { lesson_num: number; start_time: string; end_time: string }[] | null;
    } | null,
    dayOfWeekTr: number,
  ): { lesson_num: number; start_time: string; end_time: string }[] | null {
    if (!school) return null;
    const isWeekend = dayOfWeekTr === 0 || dayOfWeekTr === 6;
    const wknd = school.lesson_schedule_weekend;
    if (isWeekend && wknd && wknd.length > 0) return wknd;
    return school.lesson_schedule ?? null;
  }

  /** Okulun lesson_schedule'ına göre şu anki ders numarası. Yoksa null. */
  private getCurrentLessonNum(
    lessonSchedule: { lesson_num: number; start_time: string; end_time: string }[] | null,
    now: Date,
  ): number | null {
    if (!lessonSchedule || lessonSchedule.length === 0) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const slot of lessonSchedule) {
      const start = this.parseTimeToMinutes(slot.start_time ?? '00:00');
      const end = this.parseTimeToMinutes(slot.end_time ?? '23:59');
      if (nowMin >= start && nowMin < end) return slot.lesson_num ?? null;
    }
    return null;
  }

  async listDevices(schoolId: string | null, role: UserRole): Promise<(SmartBoardDevice & { current_slot?: { lesson_num: number; subject: string; teacher_name: string; class_section: string | null } })[]> {
    if (role !== UserRole.school_admin && role !== UserRole.superadmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (role === UserRole.school_admin && !schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const qb = this.deviceRepo.createQueryBuilder('d').orderBy('d.name', 'ASC');
    if (schoolId) {
      qb.andWhere('d.school_id = :schoolId', { schoolId });
    }
    const devices = await qb.getMany();
    if (devices.length === 0) return devices;

    const now = new Date();
    const dayOfWeek = this.getDayOfWeekTR(now);
    let currentLessonNum: number | null = null;
    if (schoolId) {
      const school = await this.schoolsService.findById(schoolId);
      currentLessonNum = this.getCurrentLessonNum(this.getEffectiveLessonSchedule(school, dayOfWeek), now);
    }

    if (dayOfWeek >= 1 && dayOfWeek <= 5 && currentLessonNum != null && schoolId) {
      const today = now.toISOString().slice(0, 10);
      const deviceIds = devices.map((d) => d.id);
      const slots = await this.scheduleRepo.find({
        where: {
          device_id: In(deviceIds),
          day_of_week: dayOfWeek,
          lesson_num: currentLessonNum,
        },
        relations: ['user'],
      });
      const slotByDevice = new Map<string, (typeof slots)[0]>();
      for (const s of slots) slotByDevice.set(s.device_id, s);

      const results: (SmartBoardDevice & {
        current_slot?: { lesson_num: number; subject: string; teacher_name: string; class_section: string | null; source?: 'timetable' | 'manual' };
      })[] = [];
      for (const d of devices) {
        const out = { ...d } as SmartBoardDevice & {
          current_slot?: { lesson_num: number; subject: string; teacher_name: string; class_section: string | null; source?: 'timetable' | 'manual' };
        };
        let slotFromTimetable: { user_id: string; subject: string; teacher_name: string } | null = null;
        if (d.classSection?.trim()) {
          try {
            slotFromTimetable = await this.timetableService.getSlotByClassSection(
              schoolId,
              today,
              d.classSection.trim(),
              currentLessonNum,
            );
          } catch {
            slotFromTimetable = null;
          }
        }
        if (slotFromTimetable) {
          out.current_slot = {
            lesson_num: currentLessonNum,
            subject: slotFromTimetable.subject,
            teacher_name: slotFromTimetable.teacher_name,
            class_section: d.classSection,
            source: 'timetable',
          };
        } else {
          const slot = slotByDevice.get(d.id);
          if (slot) {
            out.current_slot = {
              lesson_num: slot.lesson_num,
              subject: slot.subject,
              teacher_name: slot.user?.display_name ?? slot.user?.email ?? '—',
              class_section: slot.class_section,
              source: 'manual',
            };
          }
        }
        results.push(out);
      }
      return results;
    }
    return devices;
  }

  async listDevicesForTeacher(userId: string, schoolId: string): Promise<SmartBoardDevice[]> {
    const school = await this.schoolsService.findById(schoolId);
    if (!this.isModuleEnabled(school)) return [];
    const autoAuthorize = school.smartBoardAutoAuthorize ?? false;
    if (!autoAuthorize) {
      const auth = await this.authRepo.findOne({ where: { school_id: schoolId, user_id: userId } });
      if (!auth) return [];
    }
    const devices = await this.deviceRepo.find({
      where: { school_id: schoolId },
      order: { name: 'ASC' },
    });
    const restrict = school.smartBoardRestrictToOwnClasses ?? false;
    if (!restrict || devices.length === 0) return devices;
    const teacherClasses = await this.timetableService.getClassSectionsForTeacher(schoolId, userId);
    const teacherClassesSet = new Set(teacherClasses.map((c) => c.toUpperCase()));
    return devices.filter((d) => {
      const cs = (d.classSection ?? '').trim().toUpperCase();
      if (!cs) return true;
      return teacherClassesSet.has(cs);
    });
  }

  async createDevice(
    schoolId: string,
    role: UserRole,
    userId?: string,
    opts?: { name?: string; class_section?: string; room_or_location?: string },
  ): Promise<SmartBoardDevice> {
    if (role !== UserRole.school_admin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (!schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const pairingCode = randomBytes(4).toString('hex').toUpperCase();
    const device = this.deviceRepo.create({
      school_id: schoolId,
      pairing_code: pairingCode,
      name: opts?.name?.trim() || 'Akıllı Tahta',
      roomOrLocation: opts?.room_or_location?.trim() || null,
      classSection: opts?.class_section?.trim() || null,
      status: 'offline',
    });
    const saved = await this.deviceRepo.save(device);
    await this.auditService.log({
      action: 'SMARTBOARD_DEVICE_CREATED',
      userId: userId ?? null,
      schoolId,
      meta: { deviceId: saved.id, pairingCode: saved.pairing_code },
    });
    return saved;
  }

  async updateDevice(
    id: string,
    dto: { name?: string; room_or_location?: string; class_section?: string; plan_position_x?: number; plan_position_y?: number; plan_floor_index?: number; status?: 'online' | 'offline' },
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<SmartBoardDevice> {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (scope.role === UserRole.school_admin && device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (dto.name !== undefined) device.name = dto.name;
    if (dto.room_or_location !== undefined) device.roomOrLocation = dto.room_or_location;
    if (dto.class_section !== undefined) device.classSection = dto.class_section?.trim() || null;
    if (dto.plan_position_x !== undefined) device.planPositionX = dto.plan_position_x;
    if (dto.plan_position_y !== undefined) device.planPositionY = dto.plan_position_y;
    if (dto.plan_floor_index !== undefined) device.planFloorIndex = Math.max(0, dto.plan_floor_index);
    if (dto.status !== undefined) {
      device.status = dto.status;
      if (dto.status === 'offline') {
        const activeSession = await this.sessionRepo.findOne({ where: { device_id: id, disconnected_at: IsNull() } });
        if (activeSession) {
          activeSession.disconnected_at = new Date();
          await this.sessionRepo.save(activeSession);
          await this.notifySessionEndedByAdmin(device, activeSession.user_id, activeSession.id);
        }
      }
    }
    return this.deviceRepo.save(device);
  }

  async removeDevice(
    id: string,
    scope: { schoolId: string | null; role: UserRole },
    userId?: string,
  ): Promise<void> {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (scope.role === UserRole.school_admin && device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    await this.sessionRepo.delete({ device_id: id });
    await this.deviceRepo.remove(device);
    await this.auditService.log({
      action: 'SMARTBOARD_DEVICE_REMOVED',
      userId: userId ?? null,
      schoolId: device.school_id,
      meta: { deviceId: id },
    });
  }

  async listAuthorizedTeachers(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<{ id: string; user_id: string; display_name: string | null; email: string; has_usb_pin: boolean }[]> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const rows = await this.authRepo.find({
      where: { school_id: schoolId },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      display_name: r.user?.display_name ?? null,
      email: r.user?.email ?? '',
      has_usb_pin: !!(r.user?.smartBoardUsbPinHash && String(r.user.smartBoardUsbPinHash).length > 0),
    }));
  }

  /**
   * Okul yöneticisi: öğretmen için USB / sınıf TV PIN’i (4–8 rakam) veya kaldırma (null).
   */
  async setTeacherUsbPin(
    schoolId: string,
    targetUserId: string,
    scope: { schoolId: string | null; role: UserRole },
    actorUserId: string | undefined,
    pin: string | null,
  ): Promise<{ ok: true }> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu işlem için yetkiniz yok.' });
    }
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user || user.role !== UserRole.teacher || user.school_id !== schoolId) {
      throw new BadRequestException({ code: 'INVALID_TEACHER', message: 'Öğretmen bu okula ait değil.' });
    }
    if (pin === null || pin === '') {
      user.smartBoardUsbPinHash = null;
      await this.userRepo.save(user);
      await this.auditService.log({
        action: 'SMARTBOARD_USB_PIN_CLEARED',
        userId: actorUserId ?? null,
        schoolId,
        meta: { targetUserId },
      });
      return { ok: true };
    }
    const normalized = String(pin).trim();
    if (!USB_PIN_PATTERN.test(normalized)) {
      throw new BadRequestException({ code: 'INVALID_PIN', message: 'PIN 4–8 haneli rakam olmalıdır.' });
    }
    user.smartBoardUsbPinHash = await bcrypt.hash(normalized, 10);
    await this.userRepo.save(user);
    await this.auditService.log({
      action: 'SMARTBOARD_USB_PIN_SET',
      userId: actorUserId ?? null,
      schoolId,
      meta: { targetUserId },
    });
    return { ok: true };
  }

  private assertUsbUnlockRate(clientIp: string): void {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const max = 24;
    const arr = (this.usbUnlockFailTs.get(clientIp) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      throw new ForbiddenException({
        code: 'USB_UNLOCK_RATE',
        message: 'Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin.',
      });
    }
  }

  private recordUsbUnlockFail(clientIp: string): void {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const arr = (this.usbUnlockFailTs.get(clientIp) ?? []).filter((t) => now - t < windowMs);
    arr.push(now);
    this.usbUnlockFailTs.set(clientIp, arr);
  }

  private clearUsbUnlockFails(clientIp: string): void {
    this.usbUnlockFailTs.delete(clientIp);
  }

  /**
   * TV sınıf ekranı: USB ile açılışta öğretmen PIN doğrulama; tek seferlik tahta oturum belirteci üretir.
   */
  async unlockClassroomWithUsbPin(
    schoolId: string,
    deviceId: string,
    pin: string,
    clientIp: string,
  ): Promise<{ access_token: string; expires_in: number; teacher_name: string | null }> {
    this.assertUsbUnlockRate(clientIp);
    const school = await this.schoolsService.findById(schoolId);
    if (!this.isModuleEnabled(school)) {
      this.recordUsbUnlockFail(clientIp);
      throw new UnauthorizedException({ code: 'USB_PIN_INVALID', message: 'PIN geçersiz veya yetki yok.' });
    }
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, school_id: schoolId } });
    if (!device) {
      this.recordUsbUnlockFail(clientIp);
      throw new UnauthorizedException({ code: 'USB_PIN_INVALID', message: 'PIN geçersiz veya yetki yok.' });
    }
    const autoAuth = school.smartBoardAutoAuthorize ?? false;
    const teachers = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.teacher, status: UserStatus.active },
      select: ['id', 'display_name', 'smartBoardUsbPinHash'],
    });
    let matched: User | null = null;
    for (const u of teachers) {
      if (!u.smartBoardUsbPinHash) continue;
      const ok = await bcrypt.compare(String(pin).trim(), u.smartBoardUsbPinHash);
      if (ok) {
        matched = u;
        break;
      }
    }
    if (!matched) {
      this.recordUsbUnlockFail(clientIp);
      throw new UnauthorizedException({ code: 'USB_PIN_INVALID', message: 'PIN geçersiz veya yetki yok.' });
    }
    if (!autoAuth) {
      const auth = await this.authRepo.findOne({ where: { school_id: schoolId, user_id: matched.id } });
      if (!auth) {
        this.recordUsbUnlockFail(clientIp);
        throw new UnauthorizedException({ code: 'USB_PIN_INVALID', message: 'PIN geçersiz veya yetki yok.' });
      }
    }
    const raw = randomBytes(32).toString('base64url');
    const token_hash = createHash('sha256').update(raw).digest('hex');
    const expires_at = new Date(Date.now() + TV_USB_TOKEN_TTL_MS);
    await this.tvUsbTokenRepo.save(
      this.tvUsbTokenRepo.create({
        token_hash,
        school_id: schoolId,
        device_id: deviceId,
        user_id: matched.id,
        expires_at,
      }),
    );
    this.clearUsbUnlockFails(clientIp);
    return {
      access_token: raw,
      expires_in: Math.floor(TV_USB_TOKEN_TTL_MS / 1000),
      teacher_name: matched.display_name ?? null,
    };
  }

  async verifyTvClassroomUsbToken(
    rawToken: string | undefined | null,
    schoolId: string,
    deviceId: string,
  ): Promise<boolean> {
    if (!rawToken?.trim()) return false;
    const token_hash = createHash('sha256').update(rawToken.trim()).digest('hex');
    const row = await this.tvUsbTokenRepo.findOne({ where: { token_hash } });
    if (!row) return false;
    if (row.expires_at.getTime() < Date.now()) return false;
    return row.school_id === schoolId && row.device_id === deviceId;
  }

  async addAuthorizedTeacher(
    schoolId: string,
    userId: string,
    scope: { schoolId: string | null; role: UserRole },
    actorUserId?: string,
  ): Promise<SmartBoardAuthorizedTeacher> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const existing = await this.authRepo.findOne({ where: { school_id: schoolId, user_id: userId } });
    if (existing) return existing;
    const auth = this.authRepo.create({ school_id: schoolId, user_id: userId });
    const saved = await this.authRepo.save(auth);
    await this.auditService.log({
      action: 'SMARTBOARD_TEACHER_AUTHORIZED',
      userId: actorUserId ?? null,
      schoolId,
      meta: { addedUserId: userId },
    });
    return saved;
  }

  async removeAuthorizedTeacher(
    schoolId: string,
    targetUserId: string,
    scope: { schoolId: string | null; role: UserRole },
    actorUserId?: string,
  ): Promise<void> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const auth = await this.authRepo.findOne({ where: { school_id: schoolId, user_id: targetUserId } });
    if (auth) {
      await this.authRepo.remove(auth);
      await this.auditService.log({
        action: 'SMARTBOARD_TEACHER_UNAUTHORIZED',
        userId: actorUserId ?? null,
        schoolId,
        meta: { removedUserId: targetUserId },
      });
    }
  }

  async getSessionsToday(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<
    {
      id: string;
      device_id: string;
      device_name: string;
      user_id: string;
      user_name: string | null;
      connected_at: string;
      disconnected_at: string | null;
      is_active: boolean;
    }[]
  > {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessions = await this.sessionRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.device', 'd')
      .innerJoinAndSelect('s.user', 'u')
      .where('d.school_id = :schoolId', { schoolId })
      .andWhere('s.connected_at >= :today', { today })
      .orderBy('s.connected_at', 'DESC')
      .getMany();
    return sessions.map((s) => ({
      id: s.id,
      device_id: s.device_id,
      device_name: s.device?.name ?? '—',
      user_id: s.user_id,
      user_name: s.user?.display_name ?? s.user?.email ?? null,
      connected_at: s.connected_at.toISOString(),
      disconnected_at: s.disconnected_at?.toISOString() ?? null,
      is_active: !s.disconnected_at,
    }));
  }

  /** TR saat diliminde 0–23 saat */
  private hourInIstanbul(d: Date): number {
    const h = d.toLocaleString('en-GB', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false });
    const n = parseInt(h, 10);
    return Number.isFinite(n) ? n % 24 : 0;
  }

  /** Oturumun [rangeStart, rangeEnd] ile kesişim süresi (dakika, yuvarlanmış). */
  private sessionMinutesInRange(
    connectedAt: Date,
    disconnectedAt: Date | null,
    rangeStart: Date,
    rangeEnd: Date,
    now: Date,
  ): number {
    const end = disconnectedAt ?? now;
    const start = connectedAt.getTime() > rangeStart.getTime() ? connectedAt : rangeStart;
    const finish = end.getTime() < rangeEnd.getTime() ? end : rangeEnd;
    if (finish.getTime() <= start.getTime()) return 0;
    return Math.round((finish.getTime() - start.getTime()) / 60_000);
  }

  /**
   * Okul tahta kullanım özeti: tarih aralığında kesişen oturumlar; sınıf / öğretmen / cihaz / saat dağılımı.
   * En fazla 90 günlük aralık.
   */
  async getUsageStats(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
    fromYmd: string,
    toYmd: string,
  ): Promise<{
    range: { from: string; to: string };
    totals: { session_count: number; total_minutes: number };
    by_class: { key: string; session_count: number; minutes: number }[];
    by_teacher: { user_id: string; user_name: string | null; session_count: number; minutes: number }[];
    by_device: {
      device_id: string;
      device_name: string;
      class_section: string | null;
      session_count: number;
      minutes: number;
    }[];
    by_hour_tr: { hour: number; count: number }[];
    items: {
      id: string;
      device_id: string;
      device_name: string;
      class_section: string | null;
      user_id: string;
      user_name: string | null;
      connected_at: string;
      disconnected_at: string | null;
      minutes_in_range: number;
      is_active: boolean;
    }[];
  }> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const from = (fromYmd || '').slice(0, 10);
    const to = (toYmd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'from ve to YYYY-MM-DD olmalıdır.' });
    }
    const rangeStart = new Date(`${from}T00:00:00+03:00`);
    const rangeEnd = new Date(`${to}T23:59:59.999+03:00`);
    if (rangeStart.getTime() > rangeEnd.getTime()) {
      throw new BadRequestException({ code: 'INVALID_RANGE', message: 'Başlangıç bitişten sonra olamaz.' });
    }
    const maxMs = 90 * 24 * 60 * 60 * 1000;
    if (rangeEnd.getTime() - rangeStart.getTime() > maxMs) {
      throw new BadRequestException({ code: 'RANGE_TOO_LONG', message: 'En fazla 90 günlük aralık seçilebilir.' });
    }

    const now = new Date();
    const sessions = await this.sessionRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.device', 'd')
      .innerJoinAndSelect('s.user', 'u')
      .where('d.school_id = :schoolId', { schoolId })
      .andWhere('s.connected_at <= :rangeEnd', { rangeEnd })
      .andWhere('(s.disconnected_at IS NULL OR s.disconnected_at >= :rangeStart)', { rangeStart })
      .orderBy('s.connected_at', 'DESC')
      .getMany();

    const classMap = new Map<string, { session_count: number; minutes: number }>();
    const teacherMap = new Map<string, { user_name: string | null; session_count: number; minutes: number }>();
    const deviceMap = new Map<
      string,
      { device_name: string; class_section: string | null; session_count: number; minutes: number }
    >();
    const hourCounts = new Array(24).fill(0) as number[];

    let totalMinutes = 0;
    const items: {
      id: string;
      device_id: string;
      device_name: string;
      class_section: string | null;
      user_id: string;
      user_name: string | null;
      connected_at: string;
      disconnected_at: string | null;
      minutes_in_range: number;
      is_active: boolean;
    }[] = [];

    for (const s of sessions) {
      const d = s.device;
      const u = s.user;
      const mins = this.sessionMinutesInRange(s.connected_at, s.disconnected_at, rangeStart, rangeEnd, now);
      const isActive = !s.disconnected_at;
      const deviceName = d?.name ?? '—';
      const classKey = (d?.classSection?.trim() || '—') as string;
      const userName = u?.display_name ?? u?.email ?? null;

      totalMinutes += mins;
      items.push({
        id: s.id,
        device_id: s.device_id,
        device_name: deviceName,
        class_section: d?.classSection?.trim() || null,
        user_id: s.user_id,
        user_name: userName,
        connected_at: s.connected_at.toISOString(),
        disconnected_at: s.disconnected_at?.toISOString() ?? null,
        minutes_in_range: mins,
        is_active: isActive,
      });

      const cc = classMap.get(classKey) ?? { session_count: 0, minutes: 0 };
      cc.session_count += 1;
      cc.minutes += mins;
      classMap.set(classKey, cc);

      const tc = teacherMap.get(s.user_id) ?? { user_name: userName, session_count: 0, minutes: 0 };
      tc.session_count += 1;
      tc.minutes += mins;
      teacherMap.set(s.user_id, tc);

      const dc = deviceMap.get(s.device_id) ?? {
        device_name: deviceName,
        class_section: d?.classSection?.trim() || null,
        session_count: 0,
        minutes: 0,
      };
      dc.session_count += 1;
      dc.minutes += mins;
      deviceMap.set(s.device_id, dc);

      if (s.connected_at.getTime() >= rangeStart.getTime() && s.connected_at.getTime() <= rangeEnd.getTime()) {
        hourCounts[this.hourInIstanbul(s.connected_at)] += 1;
      }
    }

    const by_class = [...classMap.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.minutes - a.minutes);
    const by_teacher = [...teacherMap.entries()]
      .map(([user_id, v]) => ({ user_id, user_name: v.user_name, session_count: v.session_count, minutes: v.minutes }))
      .sort((a, b) => b.minutes - a.minutes);
    const by_device = [...deviceMap.entries()]
      .map(([device_id, v]) => ({ device_id, ...v }))
      .sort((a, b) => b.minutes - a.minutes);
    const by_hour_tr = hourCounts.map((count, hour) => ({ hour, count }));

    return {
      range: { from, to },
      totals: { session_count: sessions.length, total_minutes: totalMinutes },
      by_class,
      by_teacher,
      by_device,
      by_hour_tr,
      items,
    };
  }

  /** Tahta / oturum uyarıları (kesik heartbeat, çevrimiçi görünüp sessiz cihaz vb.) */
  async getBoardHealthAlerts(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<{
    alerts: {
      severity: 'warning' | 'info';
      code: string;
      title: string;
      detail: string;
      device_id?: string;
      session_id?: string;
    }[];
  }> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const school = await this.schoolsService.findById(schoolId);
    const timeoutMin = school?.smartBoardSessionTimeoutMinutes ?? 2;
    const staleHeartbeatMs = Math.max(timeoutMin + 1, 3) * 60 * 1000;
    const now = new Date();
    const alerts: {
      severity: 'warning' | 'info';
      code: string;
      title: string;
      detail: string;
      device_id?: string;
      session_id?: string;
    }[] = [];

    const devices = await this.deviceRepo.find({ where: { school_id: schoolId } });
    const activeSessions = await this.sessionRepo.find({
      where: { disconnected_at: IsNull() },
      relations: ['device', 'user'],
    });

    for (const s of activeSessions) {
      if (s.device?.school_id !== schoolId) continue;
      const hb = s.last_heartbeat_at ?? s.connected_at;
      if (now.getTime() - hb.getTime() > staleHeartbeatMs) {
        const teacher = s.user?.display_name || s.user?.email || 'Öğretmen';
        alerts.push({
          severity: 'warning',
          code: 'STALE_HEARTBEAT',
          title: 'Oturum sinyali zayıf veya kesildi',
          detail: `${s.device?.name ?? 'Tahta'} · ${teacher}: son sinyal gecikmeli; tahta uygulaması kapalı olabilir veya ağ sorunu.`,
          device_id: s.device_id,
          session_id: s.id,
        });
      }
    }

    for (const d of devices) {
      if (d.status === 'online' && d.last_seen_at) {
        const seen = new Date(d.last_seen_at).getTime();
        if (now.getTime() - seen > ONLINE_THRESHOLD_MS) {
          alerts.push({
            severity: 'warning',
            code: 'DEVICE_ONLINE_STALE',
            title: 'Çevrimiçi görünüyor ama yanıt yok',
            detail: `${d.name}: panel son görülme zamanı güncel değil; cihaz kapalı veya eşleşme kopmuş olabilir.`,
            device_id: d.id,
          });
        }
      }
      if (d.status === 'offline' && !d.last_seen_at && d.created_at) {
        const ageDays = (now.getTime() - new Date(d.created_at).getTime()) / (24 * 60 * 60 * 1000);
        if (ageDays >= 14) {
          alerts.push({
            severity: 'info',
            code: 'DEVICE_NEVER_CONNECTED',
            title: 'Henüz bağlanmamış tahta',
            detail: `${d.name}: oluşturulalı ${Math.floor(ageDays)} gün oldu; eşleme kodu sınıfta girilmedi.`,
            device_id: d.id,
          });
        }
      }
    }

    return { alerts };
  }

  async connect(
    deviceId: string,
    userId: string,
    schoolId: string,
  ): Promise<{ session_id: string }> {
    const school = await this.schoolsService.findById(schoolId);
    if (!this.isModuleEnabled(school)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Akıllı Tahta modülü bu okulda kapalı.' });
    }
    const autoAuthorize = school.smartBoardAutoAuthorize ?? false;
    if (!autoAuthorize) {
      const auth = await this.authRepo.findOne({ where: { school_id: schoolId, user_id: userId } });
      if (!auth) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Tahtaya bağlanma yetkiniz yok.' });
      }
    }
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (device.school_id !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu cihaza erişim yetkiniz yok.' });
    }
    const restrict = school.smartBoardRestrictToOwnClasses ?? false;
    if (restrict && device.classSection?.trim()) {
      const teacherClasses = await this.timetableService.getClassSectionsForTeacher(schoolId, userId);
      const cs = device.classSection.trim().toUpperCase();
      const allowed = teacherClasses.includes(cs);
      if (!allowed) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Bu sınıfın tahtasına bağlanma yetkiniz yok. Sadece ders verdiğiniz sınıfların tahtalarına bağlanabilirsiniz.',
        });
      }
    }
    const activeSession = await this.sessionRepo.findOne({
      where: { device_id: deviceId, disconnected_at: IsNull() },
    });
    if (activeSession) {
      if (activeSession.user_id === userId) {
        return { session_id: activeSession.id };
      }
      throw new BadRequestException({
        code: 'DEVICE_BUSY',
        message: 'Bu tahta şu an başka bir öğretmen tarafından kullanılıyor.',
      });
    }
    const session = this.sessionRepo.create({
      device_id: deviceId,
      user_id: userId,
      connected_at: new Date(),
      last_heartbeat_at: new Date(),
    });
    const saved = await this.sessionRepo.save(session);
    device.last_seen_at = new Date();
    device.status = 'online';
    await this.deviceRepo.save(device);
    return { session_id: saved.id };
  }

  async disconnect(
    sessionId: string,
    scope: { userId: string; schoolId: string | null; role: UserRole },
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['device'],
    });
    if (!session) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Oturum bulunamadı.' });
    const canDisconnect =
      scope.role === UserRole.school_admin || session.user_id === scope.userId;
    if (!canDisconnect) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu oturumu sonlandırma yetkiniz yok.' });
    }
    if (session.disconnected_at) return;
    const disconnectedTeacherId = session.user_id;
    const isAdminDisconnectingOther = scope.role === UserRole.school_admin && disconnectedTeacherId !== scope.userId;
    session.disconnected_at = new Date();
    await this.sessionRepo.save(session);
    const device = await this.deviceRepo.findOne({ where: { id: session.device_id } });
    if (device) {
      const hasOtherActive = await this.sessionRepo.findOne({
        where: { device_id: device.id, disconnected_at: IsNull() },
      });
      if (!hasOtherActive) {
        device.status = 'offline';
        await this.deviceRepo.save(device);
      }
      if (isAdminDisconnectingOther && device.school_id) {
        await this.notifySessionEndedByAdmin(device, disconnectedTeacherId, sessionId);
      }
    }
  }

  /** Okul tarafından tahta kapatma / bağlantı kesme: öğretmene + okul adminlerine bildirim */
  private async notifySessionEndedByAdmin(device: SmartBoardDevice, disconnectedTeacherId: string, sessionId: string): Promise<void> {
    if (!device.school_id) return;
    try {
      const school = await this.schoolsService.findById(device.school_id);
      const notifyTeacher = school?.smartBoardNotifyOnDisconnect !== false;

      if (notifyTeacher) {
        await this.notificationsService.createInboxEntry({
          user_id: disconnectedTeacherId,
          event_type: 'smart_board.disconnected_by_admin',
          entity_id: sessionId,
          target_screen: 'akilli-tahta',
          title: 'Akıllı Tahta bağlantınız sonlandırıldı',
          body: `${device.name} tahtasına olan bağlantınız okul yöneticisi tarafından sonlandırıldı.`,
        });
      }

      const admins = await this.userRepo.find({
        where: { school_id: device.school_id, role: UserRole.school_admin, status: UserStatus.active },
        select: ['id'],
      });
      const teacherUser = await this.userRepo.findOne({
        where: { id: disconnectedTeacherId },
        select: ['display_name', 'email'],
      });
      const teacherLabel = teacherUser?.display_name || teacherUser?.email || 'Öğretmen';
      for (const admin of admins) {
        await this.notificationsService.createInboxEntry({
          user_id: admin.id,
          event_type: 'smart_board.session_ended_by_admin',
          entity_id: sessionId,
          target_screen: 'akilli-tahta',
          title: 'Tahta bağlantısı sonlandırıldı',
          body: `${device.name} tahtasındaki ${teacherLabel} bağlantısı sonlandırıldı.`,
        });
      }
    } catch {
      /* Bildirim hataları sessizce geçer */
    }
  }

  async heartbeat(sessionId: string, userId: string): Promise<{ ok: boolean }> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['device'],
    });
    if (!session || session.user_id !== userId) return { ok: false };
    if (session.disconnected_at) return { ok: false };
    const now = new Date();
    const device = session.device;
    if (device?.school_id) {
      try {
        const school = await this.schoolsService.findById(device.school_id);
        const dow = this.getDayOfWeekTR(now);
        const sched = this.getEffectiveLessonSchedule(school, dow);
        if (school?.smartBoardAutoDisconnectLessonEnd && sched?.length) {
          const lastLesson = sched.reduce((a, b) =>
            (b.lesson_num ?? 0) > (a.lesson_num ?? 0) ? b : a
          );
          const endMin = this.parseTimeToMinutes(lastLesson.end_time ?? '23:59');
          const nowMin = now.getHours() * 60 + now.getMinutes();
          if (nowMin >= endMin) {
            session.disconnected_at = now;
            await this.sessionRepo.save(session);
            device.status = 'offline';
            await this.deviceRepo.save(device);
            return { ok: false };
          }
        }
      } catch {
        /* Devam et */
      }
    }
    session.last_heartbeat_at = now;
    await this.sessionRepo.save(session);
    if (device) {
      device.last_seen_at = now;
      device.status = 'online';
      await this.deviceRepo.save(device);
    }
    return { ok: true };
  }

  async getDeviceById(deviceId: string, scope: { schoolId: string | null; role: UserRole }): Promise<SmartBoardDevice> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (scope.role === UserRole.school_admin && device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    return device;
  }

  /**
   * Tahta ekranı (Duyuru TV classroom) için public slot bilgisi.
   * device_id veya pairing_code ile çağrılır; auth gerekmez.
   */
  async getDisplaySlotForDevice(
    schoolId: string,
    deviceIdOrPairingCode: string,
  ): Promise<{ lesson_num: number; subject: string; teacher_name: string; class_section: string | null } | null> {
    const device = await this.deviceRepo.findOne({
      where: [
        { id: deviceIdOrPairingCode, school_id: schoolId },
        { pairing_code: deviceIdOrPairingCode, school_id: schoolId },
      ],
    });
    if (!device) return null;

    const now = new Date();
    const dayOfWeek = this.getDayOfWeekTR(now);
    const school = await this.schoolsService.findById(schoolId);
    const currentLessonNum = this.getCurrentLessonNum(this.getEffectiveLessonSchedule(school, dayOfWeek), now);
    if (dayOfWeek < 1 || dayOfWeek > 5 || currentLessonNum == null) return null;

    const today = now.toISOString().slice(0, 10);
    if (device.classSection?.trim()) {
      try {
        const slot = await this.timetableService.getSlotByClassSection(
          schoolId,
          today,
          device.classSection.trim(),
          currentLessonNum,
        );
        if (slot)
          return {
            lesson_num: currentLessonNum,
            subject: slot.subject,
            teacher_name: slot.teacher_name,
            class_section: device.classSection,
          };
      } catch {
        /* fallback to manual */
      }
    }
    const manualSlot = await this.scheduleRepo.findOne({
      where: {
        device_id: device.id,
        day_of_week: dayOfWeek,
        lesson_num: currentLessonNum,
      },
      relations: ['user'],
    });
    if (manualSlot)
      return {
        lesson_num: manualSlot.lesson_num,
        subject: manualSlot.subject,
        teacher_name: manualSlot.user?.display_name ?? manualSlot.user?.email ?? '—',
        class_section: manualSlot.class_section,
      };
    return null;
  }

  async getDeviceSchedule(
    deviceId: string,
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<{ day_of_week: number; lesson_num: number; user_id: string; teacher_name: string; subject: string; class_section: string | null; source?: 'timetable' | 'manual' }[]> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (scope.role === UserRole.school_admin && device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }

    const manualRows = await this.scheduleRepo.find({
      where: { device_id: deviceId },
      relations: ['user'],
      order: { day_of_week: 'ASC', lesson_num: 'ASC' },
    });
    const manualMap = new Map<string, (typeof manualRows)[0]>();
    for (const r of manualRows) manualMap.set(`${r.day_of_week}-${r.lesson_num}`, r);

    if (device.classSection?.trim() && device.school_id) {
      try {
        const timetableSlots = await this.timetableService.getSlotsByClassSectionForWeek(
          device.school_id,
          device.classSection.trim(),
        );
        const timetableMap = new Map<string, (typeof timetableSlots)[0]>();
        for (const s of timetableSlots) timetableMap.set(`${s.day_of_week}-${s.lesson_num}`, s);

        const keys = new Set([...manualMap.keys(), ...timetableMap.keys()]);
        const result: { day_of_week: number; lesson_num: number; user_id: string; teacher_name: string; subject: string; class_section: string | null; source: 'timetable' | 'manual' }[] = [];
        for (const key of keys) {
          const [d, l] = key.split('-').map(Number);
          const manual = manualMap.get(key);
          const timetable = timetableMap.get(key);
          if (manual) {
            result.push({
              day_of_week: manual.day_of_week,
              lesson_num: manual.lesson_num,
              user_id: manual.user_id,
              teacher_name: manual.user?.display_name ?? manual.user?.email ?? '—',
              subject: manual.subject,
              class_section: manual.class_section,
              source: 'manual',
            });
          } else if (timetable) {
            result.push({
              day_of_week: timetable.day_of_week,
              lesson_num: timetable.lesson_num,
              user_id: timetable.user_id,
              teacher_name: timetable.teacher_name,
              subject: timetable.subject,
              class_section: device.classSection,
              source: 'timetable',
            });
          }
        }
        result.sort((a, b) => a.day_of_week - b.day_of_week || a.lesson_num - b.lesson_num);
        return result;
      } catch {
        /* fallback to manual only */
      }
    }

    return manualRows.map((r) => ({
      day_of_week: r.day_of_week,
      lesson_num: r.lesson_num,
      user_id: r.user_id,
      teacher_name: r.user?.display_name ?? r.user?.email ?? '—',
      subject: r.subject,
      class_section: r.class_section,
      source: 'manual' as const,
    }));
  }

  async upsertDeviceScheduleSlot(
    deviceId: string,
    body: { day_of_week: number; lesson_num: number; user_id: string; subject: string; class_section?: string },
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<void> {
    if (scope.role !== UserRole.school_admin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece okul yöneticisi program atayabilir.' });
    }
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (body.day_of_week < 1 || body.day_of_week > 7) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Gün 1-7 arası olmalı.' });
    }
    if (body.lesson_num < 1 || body.lesson_num > 12) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Ders saati 1-12 arası olmalı.' });
    }
    const existing = await this.scheduleRepo.findOne({
      where: { device_id: deviceId, day_of_week: body.day_of_week, lesson_num: body.lesson_num },
    });
    if (existing) {
      existing.user_id = body.user_id;
      existing.subject = body.subject.trim();
      existing.class_section = body.class_section?.trim() || null;
      await this.scheduleRepo.save(existing);
    } else {
      const slot = this.scheduleRepo.create({
        device_id: deviceId,
        day_of_week: body.day_of_week,
        lesson_num: body.lesson_num,
        user_id: body.user_id,
        subject: body.subject.trim(),
        class_section: body.class_section?.trim() || null,
      });
      await this.scheduleRepo.save(slot);
    }
  }

  async deleteDeviceScheduleSlot(
    deviceId: string,
    dayOfWeek: number,
    lessonNum: number,
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<void> {
    if (scope.role !== UserRole.school_admin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece okul yöneticisi program silebilir.' });
    }
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    await this.scheduleRepo.delete({
      device_id: deviceId,
      day_of_week: dayOfWeek,
      lesson_num: lessonNum,
    });
  }
}
