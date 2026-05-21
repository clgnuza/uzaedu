import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, QueryFailedError } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { SmartBoardDevice } from './entities/smart-board-device.entity';
import { SmartBoardDeviceSchedule } from './entities/smart-board-device-schedule.entity';
import { SmartBoardAuthorizedTeacher } from './entities/smart-board-authorized-teacher.entity';
import { SmartBoardSession } from './entities/smart-board-session.entity';
import { TvClassroomUsbToken } from './entities/tv-classroom-usb-token.entity';
import { SmartBoardQrSession } from './entities/smart-board-qr-session.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, UserStatus } from '../types/enums';
import { SchoolsService } from '../schools/schools.service';
import { AuditService } from '../audit/audit.service';
import { TeacherTimetableService } from '../teacher-timetable/teacher-timetable.service';
import { normalizeClassSectionForStorage } from '../teacher-timetable/class-timetable';
import { NotificationsService } from '../notifications/notifications.service';
import { School } from '../schools/entities/school.entity';
import { env } from '../config/env';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 dakika
const SETUP_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TV_USB_TOKEN_TTL_MS = 10 * 60 * 60 * 1000; // 10 saat (okul günü)
const SMART_BOARD_QR_TTL_MS = 2 * 60 * 1000; // 2 dakika
const QR_EXCHANGE_TTL_MS = 90 * 1000; // tahta token alışı
const QR_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const USB_PIN_PATTERN = /^\d{4,8}$/;
/** İki ders arası bu kadar dk ve üzeri boşluk öğle arası sayılır. */
const LUNCH_GAP_MIN_MINUTES = 25;

type TvRateBucket =
  | 'qr_create'
  | 'qr_poll'
  | 'qr_exchange'
  | 'usb_unlock'
  | 'session_status'
  | 'setup_lookup'
  | 'setup_register';

@Injectable()
export class SmartBoardService {
  private readonly usbUnlockFailTs = new Map<string, number[]>();
  private readonly tvEndpointHits = new Map<string, number[]>();

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
    @InjectRepository(SmartBoardQrSession)
    private readonly qrSessionRepo: Repository<SmartBoardQrSession>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
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
  ): Promise<{
    enabled: boolean;
    authorized: boolean;
    session_timeout_minutes?: number;
    mySession?: { session_id: string; device_id: string; device_name: string };
    myClassSections?: string[];
  }> {
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
    const result: {
      enabled: boolean;
      authorized: boolean;
      session_timeout_minutes?: number;
      mySession?: { session_id: string; device_id: string; device_name: string };
      myClassSections?: string[];
    } = {
      enabled: true,
      authorized,
      session_timeout_minutes: school.smartBoardSessionTimeoutMinutes ?? 2,
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

  /** Şu anki ve bir sonraki ders numarası (lesson_schedule). */
  private getCurrentAndNextLessonNums(
    lessonSchedule: { lesson_num: number; start_time: string; end_time: string }[] | null,
    now: Date,
  ): { current: number | null; next: number | null } {
    if (!lessonSchedule?.length) return { current: null, next: null };
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let current: number | null = null;
    let next: number | null = null;
    const sorted = [...lessonSchedule].sort(
      (a, b) => this.parseTimeToMinutes(a.start_time) - this.parseTimeToMinutes(b.start_time),
    );
    for (const slot of sorted) {
      const start = this.parseTimeToMinutes(slot.start_time ?? '00:00');
      const end = this.parseTimeToMinutes(slot.end_time ?? '23:59');
      if (nowMin >= start && nowMin < end) current = slot.lesson_num ?? null;
      if (nowMin < start && next == null) next = slot.lesson_num ?? null;
    }
    if (current != null && next == null) {
      const cur = sorted.find((s) => s.lesson_num === current);
      const curEnd = cur ? this.parseTimeToMinutes(cur.end_time ?? '23:59') : nowMin;
      for (const slot of sorted) {
        const start = this.parseTimeToMinutes(slot.start_time ?? '00:00');
        if (start >= curEnd) {
          next = slot.lesson_num ?? null;
          break;
        }
      }
    }
    return { current, next };
  }

  /** Ders programındaki en uzun ara (genelde öğle arası). */
  private findLunchGapMinutes(
    sorted: { lesson_num: number; start_time: string; end_time: string }[],
  ): { gapStartMin: number; gapEndMin: number } | null {
    let best: { gapStartMin: number; gapEndMin: number; span: number } | null = null;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapStartMin = this.parseTimeToMinutes(sorted[i]?.end_time ?? '12:00');
      const gapEndMin = this.parseTimeToMinutes(sorted[i + 1]?.start_time ?? '13:00');
      const span = gapEndMin - gapStartMin;
      if (span >= LUNCH_GAP_MIN_MINUTES && (!best || span > best.span)) {
        best = { gapStartMin, gapEndMin, span };
      }
    }
    return best ? { gapStartMin: best.gapStartMin, gapEndMin: best.gapEndMin } : null;
  }

  /** none | duyuru = oturum kes, tahta çevrimiçi | close = oturum + offline */
  private getAutoLessonEndAction(
    lessonSchedule: { lesson_num: number; start_time: string; end_time: string }[] | null,
    now: Date,
    lunchGraceMin: number,
    endDayGraceMin: number,
  ): 'none' | 'duyuru' | 'close' {
    if (!lessonSchedule?.length) return 'none';
    if (this.getCurrentLessonNum(lessonSchedule, now) != null) return 'none';
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const sorted = [...lessonSchedule].sort(
      (a, b) => this.parseTimeToMinutes(a.start_time) - this.parseTimeToMinutes(b.start_time),
    );
    const lastEnd = this.parseTimeToMinutes(sorted[sorted.length - 1]?.end_time ?? '23:59');
    if (nowMin >= lastEnd + endDayGraceMin) return 'close';

    const lunch = this.findLunchGapMinutes(sorted);
    if (
      lunch &&
      nowMin >= lunch.gapStartMin + lunchGraceMin &&
      nowMin < lunch.gapEndMin
    ) {
      return 'duyuru';
    }
    return 'none';
  }

  private secondsUntilScheduleMinute(targetMin: number, now: Date): number {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return Math.max(1, (targetMin - nowMin) * 60 - now.getSeconds());
  }

  /** Kapanma/duyuru öncesi tahta uyarısı (grace süresi içinde, işlem henüz yapılmadan). */
  private getLessonEndShutdownWarning(
    lessonSchedule: { lesson_num: number; start_time: string; end_time: string }[] | null,
    now: Date,
    lunchGraceMin: number,
    endDayGraceMin: number,
  ): { kind: 'duyuru' | 'close'; seconds_left: number; title: string; detail: string } | null {
    if (!lessonSchedule?.length) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const sorted = [...lessonSchedule].sort(
      (a, b) => this.parseTimeToMinutes(a.start_time) - this.parseTimeToMinutes(b.start_time),
    );
    const lastEnd = this.parseTimeToMinutes(sorted[sorted.length - 1]?.end_time ?? '23:59');
    const closeAt = lastEnd + endDayGraceMin;
    if (nowMin >= lastEnd && nowMin < closeAt) {
      const sec = this.secondsUntilScheduleMinute(closeAt, now);
      return {
        kind: 'close',
        seconds_left: sec,
        title: 'Tahta kapanacak',
        detail: `${Math.max(1, Math.ceil(sec / 60))} dk içinde oturum sonlanır ve tahta kapatılır. Kayıtlarınızı kaydedin.`,
      };
    }
    const lunch = this.findLunchGapMinutes(sorted);
    const lunchAt = lunch ? lunch.gapStartMin + lunchGraceMin : -1;
    if (lunch && nowMin >= lunch.gapStartMin && nowMin < lunchAt) {
      const sec = this.secondsUntilScheduleMinute(lunchAt, now);
      return {
        kind: 'duyuru',
        seconds_left: sec,
        title: 'Duyuru moduna geçiliyor',
        detail: `${Math.max(1, Math.ceil(sec / 60))} dk içinde ders oturumu kapanır; ekran duyuru TV moduna döner.`,
      };
    }
    return null;
  }

  private async endSessionForDuyuruMode(
    session: SmartBoardSession,
    device: SmartBoardDevice,
    at: Date = new Date(),
  ): Promise<void> {
    session.disconnected_at = at;
    await this.sessionRepo.save(session);
    device.last_seen_at = at;
    device.status = 'online';
    await this.deviceRepo.save(device);
  }

  private async closeBoardAfterSchoolDay(
    session: SmartBoardSession,
    device: SmartBoardDevice,
    at: Date = new Date(),
  ): Promise<void> {
    session.disconnected_at = at;
    await this.sessionRepo.save(session);
    const hasOther = await this.sessionRepo.findOne({
      where: { device_id: device.id, disconnected_at: IsNull() },
    });
    if (!hasOther) {
      device.status = 'offline';
      await this.deviceRepo.save(device);
    }
  }

  private async maybeAutoDisconnectForLessonEnd(
    school: School | null,
    device: SmartBoardDevice,
    session: SmartBoardSession,
    now: Date,
  ): Promise<boolean> {
    if (!school?.smartBoardAutoDisconnectLessonEnd) return false;
    const sched = this.getEffectiveLessonSchedule(school, this.getDayOfWeekTR(now));
    const lunchGrace = school.smartBoardLunchDuyuruGraceMinutes ?? 10;
    const endGrace = school.smartBoardEndOfDayCloseGraceMinutes ?? 10;
    const action = this.getAutoLessonEndAction(sched, now, lunchGrace, endGrace);
    if (action === 'none') return false;
    if (action === 'duyuru') await this.endSessionForDuyuruMode(session, device, now);
    else await this.closeBoardAfterSchoolDay(session, device, now);
    return true;
  }

  private async clearDevicePendingTakeover(deviceId: string): Promise<void> {
    await this.deviceRepo.update(deviceId, {
      pendingTakeoverUntil: null,
      pendingTakeoverUserId: null,
      pendingTakeoverQrSessionId: null,
    });
  }

  /** Yumuşak devralma süresi dolduysa bağlan + QR exchange hazırla. */
  private async completePendingTakeoverIfDue(deviceId: string, schoolId: string): Promise<boolean> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, school_id: schoolId } });
    if (!device?.pendingTakeoverUntil || !device.pendingTakeoverUserId || !device.pendingTakeoverQrSessionId) {
      return false;
    }
    if (device.pendingTakeoverUntil.getTime() > Date.now()) return false;

    const qrSessionId = device.pendingTakeoverQrSessionId;
    const teacherUserId = device.pendingTakeoverUserId;
    const sess = await this.qrSessionRepo.findOne({
      where: { id: qrSessionId, school_id: schoolId, device_id: deviceId },
    });
    await this.clearDevicePendingTakeover(deviceId);
    if (!sess || sess.exchanged_at || !sess.claimed_at) return false;

    const school = await this.schoolsService.findById(schoolId);
    const releasePrevious = school.smartBoardReleasePreviousOnQr ?? true;
    await this.connect(deviceId, teacherUserId, schoolId, { releaseOtherOnDevice: releasePrevious });
    const exchangeNonce = randomBytes(24).toString('base64url');
    sess.exchange_nonce = exchangeNonce;
    sess.exchange_expires_at = new Date(Date.now() + QR_EXCHANGE_TTL_MS);
    await this.qrSessionRepo.save(sess);
    return true;
  }

  private async teacherCanReconnectWithoutQr(
    schoolId: string,
    deviceId: string,
    userId: string,
    graceMinutes: number,
  ): Promise<boolean> {
    if (graceMinutes <= 0) return false;
    const last = await this.sessionRepo.findOne({
      where: { device_id: deviceId, user_id: userId },
      order: { disconnected_at: 'DESC' },
    });
    if (!last?.disconnected_at) return false;
    return Date.now() - last.disconnected_at.getTime() <= graceMinutes * 60 * 1000;
  }

  async listDevices(schoolId: string | null, role: UserRole): Promise<(SmartBoardDevice & { current_slot?: { lesson_num: number; subject: string; teacher_name: string; class_section: string | null } })[]> {
    if (role !== UserRole.school_admin && role !== UserRole.superadmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (role === UserRole.school_admin && !schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const qb = this.deviceRepo
      .createQueryBuilder('d')
      .orderBy('d.classSection', 'ASC', 'NULLS LAST')
      .addOrderBy('d.name', 'ASC');
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

  async listDevicesForTeacher(
    userId: string,
    schoolId: string,
  ): Promise<
    (SmartBoardDevice & {
      lesson_context?: {
        my_lesson_today: boolean;
        my_lesson_now: boolean;
        my_next_lesson: { lesson_num: number; subject: string; starts_in_minutes: number } | null;
        current_slot: { lesson_num: number; subject: string; teacher_name: string } | null;
        busy_teacher_name: string | null;
        reconnect_without_qr: boolean;
      };
    })[]
  > {
    const school = await this.schoolsService.findById(schoolId);
    if (!this.isModuleEnabled(school)) return [];
    const autoAuthorize = school.smartBoardAutoAuthorize ?? false;
    if (!autoAuthorize) {
      const auth = await this.authRepo.findOne({ where: { school_id: schoolId, user_id: userId } });
      if (!auth) return [];
    }
    let devices = await this.deviceRepo.find({
      where: { school_id: schoolId },
      order: { classSection: 'ASC', name: 'ASC' },
    });
    const restrict = school.smartBoardRestrictToOwnClasses ?? false;
    if (restrict && devices.length > 0) {
      const teacherClasses = await this.timetableService.getClassSectionsForTeacher(schoolId, userId);
      const teacherClassesSet = new Set(teacherClasses.map((c) => c.toUpperCase()));
      devices = devices.filter((d) => {
        const cs = (d.classSection ?? '').trim().toUpperCase();
        if (!cs) return true;
        return teacherClassesSet.has(cs);
      });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayOfWeek = this.getDayOfWeekTR(now);
    const lessonSchedule = this.getEffectiveLessonSchedule(school, dayOfWeek);
    const { current: currentLessonNum, next: nextLessonNum } = this.getCurrentAndNextLessonNums(lessonSchedule, now);
    const graceMin = school.smartBoardReconnectGraceMinutes ?? 45;
    const mySlotsToday =
      dayOfWeek >= 1 && dayOfWeek <= 5
        ? (await this.timetableService.getByDate(schoolId, today))[userId] ?? {}
        : {};
    const myClassSectionsToday = new Set(
      Object.values(mySlotsToday)
        .map((s) => (s.class_section ?? '').trim().toUpperCase())
        .filter(Boolean),
    );

    const out: (SmartBoardDevice & {
      lesson_context?: {
        my_lesson_today: boolean;
        my_lesson_now: boolean;
        my_next_lesson: { lesson_num: number; subject: string; starts_in_minutes: number } | null;
        current_slot: { lesson_num: number; subject: string; teacher_name: string } | null;
        busy_teacher_name: string | null;
        reconnect_without_qr: boolean;
      };
    })[] = [];

    for (const d of devices) {
      const cs = (d.classSection ?? '').trim().toUpperCase();
      /** Program yoksa veya sınıfsız tahtaysa listede kalır; aksi halde bugünkü ders sınıfları. */
      const myLessonToday =
        !cs || myClassSectionsToday.size === 0 || myClassSectionsToday.has(cs);
      let myLessonNow = false;
      let myNextLesson: { lesson_num: number; subject: string; starts_in_minutes: number } | null = null;
      let currentSlot: { lesson_num: number; subject: string; teacher_name: string } | null = null;

      if (cs && dayOfWeek >= 1 && dayOfWeek <= 5) {
        for (const [ln, slot] of Object.entries(mySlotsToday)) {
          if ((slot.class_section ?? '').trim().toUpperCase() === cs) {
            const num = Number(ln);
            if (currentLessonNum != null && num === currentLessonNum) myLessonNow = true;
            if (nextLessonNum != null && num === nextLessonNum) {
              const schedSlot = lessonSchedule?.find((s) => s.lesson_num === nextLessonNum);
              const startMin = schedSlot ? this.parseTimeToMinutes(schedSlot.start_time) : 0;
              const nowMin = now.getHours() * 60 + now.getMinutes();
              myNextLesson = {
                lesson_num: num,
                subject: slot.subject ?? '',
                starts_in_minutes: Math.max(0, startMin - nowMin),
              };
            }
          }
        }
        if (currentLessonNum != null) {
          try {
            const slot = await this.timetableService.getSlotByClassSection(
              schoolId,
              today,
              d.classSection!.trim(),
              currentLessonNum,
            );
            if (slot) {
              currentSlot = {
                lesson_num: currentLessonNum,
                subject: slot.subject,
                teacher_name: slot.teacher_name,
              };
            }
          } catch {
            /* ignore */
          }
        }
      }

      const active = await this.sessionRepo.findOne({
        where: { device_id: d.id, disconnected_at: IsNull() },
        relations: ['user'],
      });
      const busyName =
        active && active.user_id !== userId
          ? active.user?.display_name ?? active.user?.email ?? null
          : null;
      const reconnectWithoutQr = await this.teacherCanReconnectWithoutQr(schoolId, d.id, userId, graceMin);

      out.push({
        ...d,
        lesson_context: {
          my_lesson_today: myLessonToday,
          my_lesson_now: myLessonNow,
          my_next_lesson: myNextLesson,
          current_slot: currentSlot,
          busy_teacher_name: busyName,
          reconnect_without_qr: reconnectWithoutQr && !busyName,
        },
      });
    }
    return out;
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
    const classSection = opts?.class_section?.trim()
      ? normalizeClassSectionForStorage(opts.class_section) || null
      : null;
    const room = opts?.room_or_location?.trim() || null;
    let name = opts?.name?.trim() || '';
    if (!classSection && !name && !room) {
      throw new BadRequestException({
        code: 'DEVICE_LABEL_REQUIRED',
        message: 'Sınıf dışı tahta için tahta adı veya lokasyon girin.',
      });
    }
    if (!name) {
      if (classSection && room) name = `${classSection} - ${room}`;
      else if (classSection) name = `${classSection} Akıllı Tahta`;
      else if (room) name = `Akıllı Tahta - ${room}`;
      else name = 'Akıllı Tahta';
    }
    return this.createDeviceInternal(
      schoolId,
      { name, class_section: classSection ?? undefined, room_or_location: room ?? undefined },
      userId,
    );
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
      meta: {
        deviceId: id,
        deviceName: device.name,
        classSection: device.classSection ?? null,
        roomOrLocation: device.roomOrLocation ?? null,
      },
    });
  }

  async listAuthorizedTeachers(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<{ id: string; user_id: string; display_name: string | null; email: string; has_usb_pin: boolean; has_otp_codes: boolean; otp_code_count: number }[]> {
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
      has_otp_codes: Array.isArray(r.user?.smartBoardOtpCodeHashes) && r.user!.smartBoardOtpCodeHashes.length > 0,
      otp_code_count: Array.isArray(r.user?.smartBoardOtpCodeHashes) ? r.user!.smartBoardOtpCodeHashes.length : 0,
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

  async regenerateTeacherOtpCodes(
    schoolId: string,
    targetUserId: string,
    scope: { schoolId: string | null; role: UserRole },
    actorUserId?: string,
    count = 8,
  ): Promise<{ ok: true; codes: string[] }> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu işlem için yetkiniz yok.' });
    }
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user || user.role !== UserRole.teacher || user.school_id !== schoolId) {
      throw new BadRequestException({ code: 'INVALID_TEACHER', message: 'Öğretmen bu okula ait değil.' });
    }
    const n = Math.min(20, Math.max(4, Number(count) || 8));
    const codes = Array.from({ length: n }, () => String(Math.floor(100000 + Math.random() * 900000)));
    user.smartBoardOtpCodeHashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
    await this.userRepo.save(user);
    await this.auditService.log({
      action: 'SMARTBOARD_OTP_CODES_REGENERATED',
      userId: actorUserId ?? null,
      schoolId,
      meta: { targetUserId, count: n },
    });
    return { ok: true, codes };
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

  private generateQrCode(): string {
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += QR_CODE_CHARS[bytes[i]! % QR_CODE_CHARS.length];
    }
    return code;
  }

  private isLoopbackClientIp(clientIp: string): boolean {
    const ip = (clientIp || '').replace(/^::ffff:/i, '').trim();
    return ip === '127.0.0.1' || ip === '::1';
  }

  private tvRateLimitMax(clientIp: string, max: number): number {
    if (process.env.NODE_ENV !== 'production' && this.isLoopbackClientIp(clientIp)) return max * 20;
    return max;
  }

  /** TV public uçları: IP başına pencere (çoklu instance’da en iyi çaba). */
  assertTvEndpointRate(clientIp: string, bucket: TvRateBucket, max: number, windowMs = 15 * 60 * 1000): void {
    const effectiveMax = this.tvRateLimitMax(clientIp, max);
    const key = `${bucket}:${clientIp || 'unknown'}`;
    const now = Date.now();
    const arr = (this.tvEndpointHits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= effectiveMax) {
      throw new ForbiddenException({
        code: 'TV_RATE_LIMIT',
        message: 'Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin.',
      });
    }
    arr.push(now);
    this.tvEndpointHits.set(key, arr);
  }

  private async teacherCanUnlockBoard(
    schoolId: string,
    userId: string,
    autoAuthorize: boolean,
  ): Promise<boolean> {
    if (autoAuthorize) return true;
    const auth = await this.authRepo.findOne({ where: { school_id: schoolId, user_id: userId } });
    return !!auth;
  }

  private async issueTvUsbToken(
    schoolId: string,
    deviceId: string,
    userId: string,
  ): Promise<{ access_token: string; expires_in: number; token_hash: string }> {
    const raw = randomBytes(32).toString('base64url');
    const token_hash = createHash('sha256').update(raw).digest('hex');
    const expires_at = new Date(Date.now() + TV_USB_TOKEN_TTL_MS);
    await this.tvUsbTokenRepo.save(
      this.tvUsbTokenRepo.create({
        token_hash,
        school_id: schoolId,
        device_id: deviceId,
        user_id: userId,
        expires_at,
      }),
    );
    return {
      access_token: raw,
      expires_in: Math.floor(TV_USB_TOKEN_TTL_MS / 1000),
      token_hash,
    };
  }

  /**
   * TV sınıf ekranı: USB ile açılışta öğretmen PIN doğrulama; tek seferlik tahta oturum belirteci üretir.
   */
  async unlockClassroomWithUsbPin(
    schoolId: string,
    deviceId: string,
    pin: string,
    clientIp: string,
    mode: 'pin' | 'otp' | 'auto' = 'auto',
  ): Promise<{ access_token: string; expires_in: number; teacher_name: string | null; unlock_method: 'pin' | 'otp' }> {
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
      select: ['id', 'display_name', 'smartBoardUsbPinHash', 'smartBoardOtpCodeHashes'],
    });
    let matched: User | null = null;
    let usedOtp = false;
    let usedOtpCode = '';
    for (const u of teachers) {
      const credential = String(pin).trim();
      if (mode !== 'otp' && u.smartBoardUsbPinHash) {
        const okPin = await bcrypt.compare(credential, u.smartBoardUsbPinHash);
        if (okPin) {
          matched = u;
          break;
        }
      }
      if (mode !== 'pin' && Array.isArray(u.smartBoardOtpCodeHashes) && u.smartBoardOtpCodeHashes.length > 0) {
        for (const h of u.smartBoardOtpCodeHashes) {
          const okOtp = await bcrypt.compare(credential, h);
          if (okOtp) {
            matched = u;
            usedOtp = true;
            usedOtpCode = credential;
            break;
          }
        }
        if (matched) break;
      }
    }
    if (!matched) {
      this.recordUsbUnlockFail(clientIp);
      throw new UnauthorizedException({ code: 'USB_PIN_INVALID', message: 'PIN geçersiz veya yetki yok.' });
    }
    const canUnlock = await this.teacherCanUnlockBoard(schoolId, matched.id, autoAuth);
    if (!canUnlock) {
      this.recordUsbUnlockFail(clientIp);
      throw new UnauthorizedException({ code: 'USB_PIN_INVALID', message: 'PIN geçersiz veya yetki yok.' });
    }
    const restrict = school.smartBoardRestrictToOwnClasses ?? false;
    if (restrict && device.classSection?.trim()) {
      const teacherClasses = await this.timetableService.getClassSectionsForTeacher(schoolId, matched.id);
      const cs = device.classSection.trim().toUpperCase();
      const allowed = teacherClasses.some((c) => c.trim().toUpperCase() === cs);
      if (!allowed) {
        this.recordUsbUnlockFail(clientIp);
        throw new UnauthorizedException({ code: 'USB_PIN_INVALID', message: 'PIN geçersiz veya yetki yok.' });
      }
    }
    if (usedOtp && matched.smartBoardOtpCodeHashes?.length) {
      const nextHashes: string[] = [];
      let consumed = false;
      for (const h of matched.smartBoardOtpCodeHashes) {
        if (!consumed && (await bcrypt.compare(usedOtpCode, h))) {
          consumed = true;
          continue;
        }
        nextHashes.push(h);
      }
      matched.smartBoardOtpCodeHashes = nextHashes;
      await this.userRepo.save(matched);
    }
    const releasePrevious = school.smartBoardReleasePreviousOnQr ?? true;
    await this.connect(deviceId, matched.id, schoolId, { releaseOtherOnDevice: releasePrevious });
    const issued = await this.issueTvUsbToken(schoolId, deviceId, matched.id);
    this.clearUsbUnlockFails(clientIp);
    await this.auditService.log({
      action: usedOtp ? 'SMARTBOARD_OTP_UNLOCK_SUCCESS' : 'SMARTBOARD_USB_PIN_UNLOCK_SUCCESS',
      userId: matched.id,
      schoolId,
      ip: clientIp,
      meta: { deviceId },
    });
    return {
      access_token: issued.access_token,
      expires_in: issued.expires_in,
      teacher_name: matched.display_name ?? null,
      unlock_method: usedOtp ? 'otp' : 'pin',
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

  async createQrLoginSession(
    schoolId: string,
    deviceId: string,
    clientIp: string,
  ): Promise<{ session_id: string; code: string; expires_in: number }> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, school_id: schoolId } });
    if (!device) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    }
    const now = Date.now();
    const pending = await this.qrSessionRepo.findOne({
      where: { school_id: schoolId, device_id: deviceId },
      order: { created_at: 'DESC' },
    });
    if (
      pending &&
      pending.expires_at.getTime() > now &&
      !pending.claimed_at &&
      !pending.exchanged_at
    ) {
      return {
        session_id: pending.id,
        code: pending.code,
        expires_in: Math.max(1, Math.floor((pending.expires_at.getTime() - now) / 1000)),
      };
    }
    this.assertTvEndpointRate(clientIp, 'qr_create', 40);
    await this.qrSessionRepo.delete({ school_id: schoolId, device_id: deviceId });
    const code = this.generateQrCode();
    const row = await this.qrSessionRepo.save(
      this.qrSessionRepo.create({
        school_id: schoolId,
        device_id: deviceId,
        code,
        expires_at: new Date(now + SMART_BOARD_QR_TTL_MS),
      }),
    );
    await this.auditService.log({
      action: 'SMARTBOARD_QR_SESSION_CREATED',
      schoolId,
      meta: { deviceId, sessionId: row.id },
    });
    void this.notifyTeachersQrSessionPending(schoolId, device, row.id, code);
    return { session_id: row.id, code, expires_in: Math.floor(SMART_BOARD_QR_TTL_MS / 1000) };
  }

  /** Tahta QR oluşturduğunda yetkili öğretmenlere Inbox bildirimi (PWA / panel). */
  private async notifyTeachersQrSessionPending(
    schoolId: string,
    device: SmartBoardDevice,
    sessionId: string,
    qrCode: string,
  ): Promise<void> {
    try {
      const school = await this.schoolsService.findById(schoolId);
      if (school.smartBoardNotifyOnQrPending === false) return;
      const autoAuth = school.smartBoardAutoAuthorize ?? false;
      const restrict = school.smartBoardRestrictToOwnClasses ?? false;
      let userIds: string[] = [];

      if (autoAuth) {
        const teachers = await this.userRepo.find({
          where: { school_id: schoolId, role: UserRole.teacher, status: UserStatus.active },
          select: ['id'],
        });
        userIds = teachers.map((t) => t.id);
      } else {
        const authRows = await this.authRepo.find({
          where: { school_id: schoolId },
          select: ['user_id'],
        });
        userIds = authRows.map((a) => a.user_id);
      }

      if (restrict && device.classSection?.trim()) {
        const classTeachers = await this.timetableService.getTeacherUserIdsForClassSection(
          schoolId,
          device.classSection.trim(),
        );
        if (classTeachers.length > 0) {
          const allowed = new Set(classTeachers);
          userIds = userIds.filter((id) => allowed.has(id));
        }
      }

      const lessonOnly = school.smartBoardNotifyLessonTeachersOnly !== false;
      if (lessonOnly && device.classSection?.trim()) {
        const now = new Date();
        const dayOfWeek = this.getDayOfWeekTR(now);
        const lessonSchedule = this.getEffectiveLessonSchedule(school, dayOfWeek);
        const { current, next } = this.getCurrentAndNextLessonNums(lessonSchedule, now);
        const today = now.toISOString().slice(0, 10);
        const slotTeachers = new Set<string>();
        for (const lessonNum of [current, next]) {
          if (lessonNum == null) continue;
          try {
            const slot = await this.timetableService.getSlotByClassSection(
              schoolId,
              today,
              device.classSection.trim(),
              lessonNum,
            );
            if (slot?.user_id) slotTeachers.add(slot.user_id);
          } catch {
            /* ignore */
          }
        }
        if (slotTeachers.size > 0) {
          userIds = userIds.filter((id) => slotTeachers.has(id));
        }
      }

      if (userIds.length === 0) return;

      const classLabel = device.classSection?.trim() || device.name;
      const panelBase = env.frontendUrl.replace(/\/$/, '');
      const panelParams = new URLSearchParams({
        open_qr: '1',
        qr_school: schoolId,
        qr_device: device.id,
        qr_session: sessionId,
        qr_code: qrCode,
      });

      const meta = {
        school_id: schoolId,
        device_id: device.id,
        session_id: sessionId,
        qr_code: qrCode,
        device_name: device.name,
        class_section: device.classSection ?? null,
        panel_url: `${panelBase}/akilli-tahta?${panelParams.toString()}`,
      };
      for (const userId of userIds.slice(0, 60)) {
        await this.notificationsService.upsertSmartBoardQrPendingInbox({
          user_id: userId,
          entity_id: sessionId,
          title: `${classLabel} — ders oturumu bekliyor`,
          body: `${classLabel} tahtasında QR onayı gerekiyor. Okutun veya bildirime dokunun.`,
          metadata: meta,
        });
      }
    } catch {
      /* Bildirim hataları sessiz */
    }
  }

  async claimQrLoginSession(
    schoolId: string,
    deviceId: string,
    sessionId: string,
    code: string,
    teacherUserId: string,
  ): Promise<{ ok: true; session_id?: string; pending_takeover_seconds?: number }> {
    const school = await this.schoolsService.findById(schoolId);
    if (!this.isModuleEnabled(school)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Akıllı Tahta modülü bu okulda kapalı.' });
    }
    const sess = await this.qrSessionRepo.findOne({
      where: { id: sessionId, school_id: schoolId, device_id: deviceId },
    });
    if (!sess || sess.expires_at.getTime() < Date.now() || !!sess.claimed_at) {
      throw new UnauthorizedException({ code: 'QR_SESSION_INVALID', message: 'QR oturumu geçersiz veya süresi doldu.' });
    }
    if (String(code || '').trim() !== sess.code) {
      throw new UnauthorizedException({ code: 'QR_CODE_INVALID', message: 'QR kod geçersiz.' });
    }
    const canUnlock = await this.teacherCanUnlockBoard(
      schoolId,
      teacherUserId,
      school.smartBoardAutoAuthorize ?? false,
    );
    if (!canUnlock) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Tahta açma yetkiniz yok.' });
    }
    const releasePrevious = school.smartBoardReleasePreviousOnQr ?? true;
    const softSec = Math.max(0, Math.min(120, school.smartBoardSoftTakeoverSeconds ?? 0));
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, school_id: schoolId } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });

    const activeOnDevice = await this.sessionRepo.findOne({
      where: { device_id: deviceId, disconnected_at: IsNull() },
      relations: ['user'],
    });

    sess.claimed_at = new Date();
    sess.claimed_user_id = teacherUserId;
    sess.exchanged_at = null;
    sess.issued_usb_token_hash = null;
    sess.issued_usb_token_plain = null;

    if (
      activeOnDevice &&
      activeOnDevice.user_id !== teacherUserId &&
      releasePrevious &&
      softSec > 0
    ) {
      device.pendingTakeoverUntil = new Date(Date.now() + softSec * 1000);
      device.pendingTakeoverUserId = teacherUserId;
      device.pendingTakeoverQrSessionId = sessionId;
      sess.exchange_nonce = null;
      sess.exchange_expires_at = null;
      await this.deviceRepo.save(device);
      await this.qrSessionRepo.save(sess);
      await this.notificationsService
        .markReadSmartBoardQrPendingForSession(schoolId, deviceId, sessionId)
        .catch(() => undefined);
      await this.auditService.log({
        action: 'SMARTBOARD_QR_SESSION_CLAIMED',
        userId: teacherUserId,
        schoolId,
        meta: { deviceId, sessionId, qrCode: code, softTakeoverSeconds: softSec },
      });
      return { ok: true, pending_takeover_seconds: softSec };
    }

    const { session_id: boardSessionId } = await this.connect(deviceId, teacherUserId, schoolId, {
      releaseOtherOnDevice: releasePrevious,
    });
    await this.clearDevicePendingTakeover(deviceId);
    const exchangeNonce = randomBytes(24).toString('base64url');
    sess.exchange_nonce = exchangeNonce;
    sess.exchange_expires_at = new Date(Date.now() + QR_EXCHANGE_TTL_MS);
    await this.qrSessionRepo.save(sess);
    await this.notificationsService
      .markReadSmartBoardQrPendingForSession(schoolId, deviceId, sessionId)
      .catch(() => undefined);
    await this.auditService.log({
      action: 'SMARTBOARD_QR_SESSION_CLAIMED',
      userId: teacherUserId,
      schoolId,
      meta: { deviceId, sessionId, qrCode: code, boardSessionId },
    });
    return { ok: true, session_id: boardSessionId };
  }

  /** Sınıf tahtasında aktif öğretmen oturumu var mı (TV duyuru ↔ kullanım modu geçişi). */
  async getClassroomActiveSessionPublic(
    schoolId: string,
    deviceId: string,
  ): Promise<{
    active: boolean;
    teacher_name: string | null;
    last_heartbeat_at?: string | null;
    session_timeout_minutes?: number;
    takeover_pending?: { seconds_left: number; incoming_teacher_name: string | null };
    shutdown_warning?: {
      kind: 'duyuru' | 'close';
      seconds_left: number;
      title: string;
      detail: string;
    };
    slot_hint?: {
      current_teacher_name: string | null;
      next_teacher_name: string | null;
      next_lesson_num: number | null;
    };
  }> {
    await this.completePendingTakeoverIfDue(deviceId, schoolId);
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, school_id: schoolId } });
    if (!device) return { active: false, teacher_name: null };
    const school = await this.schoolsService.findById(schoolId);
    const timeoutMin = school?.smartBoardSessionTimeoutMinutes ?? 2;

    let takeover_pending: { seconds_left: number; incoming_teacher_name: string | null } | undefined;
    if (device.pendingTakeoverUntil && device.pendingTakeoverUntil.getTime() > Date.now()) {
      const incoming = device.pendingTakeoverUserId
        ? await this.userRepo.findOne({
            where: { id: device.pendingTakeoverUserId },
            select: ['display_name', 'email'],
          })
        : null;
      takeover_pending = {
        seconds_left: Math.max(0, Math.ceil((device.pendingTakeoverUntil.getTime() - Date.now()) / 1000)),
        incoming_teacher_name: incoming?.display_name ?? incoming?.email ?? null,
      };
    }

    let slot_hint: {
      current_teacher_name: string | null;
      next_teacher_name: string | null;
      next_lesson_num: number | null;
    } | undefined;
    if (device.classSection?.trim()) {
      const now = new Date();
      const dayOfWeek = this.getDayOfWeekTR(now);
      const lessonSchedule = this.getEffectiveLessonSchedule(school, dayOfWeek);
      const { current, next } = this.getCurrentAndNextLessonNums(lessonSchedule, now);
      const today = now.toISOString().slice(0, 10);
      let currentTeacher: string | null = null;
      let nextTeacher: string | null = null;
      if (current != null) {
        try {
          const slot = await this.timetableService.getSlotByClassSection(
            schoolId,
            today,
            device.classSection.trim(),
            current,
          );
          currentTeacher = slot?.teacher_name ?? null;
        } catch {
          /* ignore */
        }
      }
      if (next != null) {
        try {
          const slot = await this.timetableService.getSlotByClassSection(
            schoolId,
            today,
            device.classSection.trim(),
            next,
          );
          nextTeacher = slot?.teacher_name ?? null;
        } catch {
          /* ignore */
        }
      }
      if (currentTeacher || nextTeacher) {
        slot_hint = {
          current_teacher_name: currentTeacher,
          next_teacher_name: nextTeacher,
          next_lesson_num: next,
        };
      }
    }
    const session = await this.sessionRepo.findOne({
      where: { device_id: deviceId, disconnected_at: IsNull() },
      relations: ['user'],
    });
    let shutdown_warning: {
      kind: 'duyuru' | 'close';
      seconds_left: number;
      title: string;
      detail: string;
    } | undefined;
    if (school?.smartBoardAutoDisconnectLessonEnd) {
      const sched = this.getEffectiveLessonSchedule(school, this.getDayOfWeekTR(new Date()));
      const w = this.getLessonEndShutdownWarning(
        sched,
        new Date(),
        school.smartBoardLunchDuyuruGraceMinutes ?? 10,
        school.smartBoardEndOfDayCloseGraceMinutes ?? 10,
      );
      if (w && w.seconds_left > 0) shutdown_warning = w;
    }

    const baseExtras = { takeover_pending, shutdown_warning, slot_hint, session_timeout_minutes: timeoutMin };
    if (!session) {
      return { active: false, teacher_name: null, ...baseExtras };
    }
    const hb = session.last_heartbeat_at ?? session.connected_at;
    const now = new Date();
    if (now.getTime() - hb.getTime() > timeoutMin * 60 * 1000) {
      await this.closeBoardAfterSchoolDay(session, device, now);
      return { active: false, teacher_name: null, ...baseExtras };
    }
    if (shutdown_warning) {
      const u = session.user;
      return {
        active: true,
        teacher_name: u?.display_name ?? u?.email ?? null,
        last_heartbeat_at: hb.toISOString(),
        ...baseExtras,
      };
    }
    if (await this.maybeAutoDisconnectForLessonEnd(school, device, session, now)) {
      return { active: false, teacher_name: null, ...baseExtras };
    }
    const u = session.user;
    return {
      active: true,
      teacher_name: u?.display_name ?? u?.email ?? null,
      last_heartbeat_at: hb.toISOString(),
      ...baseExtras,
    };
  }

  async pollQrLoginSession(
    schoolId: string,
    deviceId: string,
    sessionId: string,
    clientIp: string,
  ): Promise<{
    approved: boolean;
    expired: boolean;
    exchange_nonce?: string;
    exchange_expires_in?: number;
    exchanged?: boolean;
    teacher_name?: string | null;
    takeover_pending?: boolean;
    takeover_seconds_left?: number;
  }> {
    this.assertTvEndpointRate(clientIp, 'qr_poll', 180);
    await this.completePendingTakeoverIfDue(deviceId, schoolId);
    const sess = await this.qrSessionRepo.findOne({
      where: { id: sessionId, school_id: schoolId, device_id: deviceId },
      relations: ['claimed_user'],
    });
    const now = Date.now();
    if (!sess || sess.expires_at.getTime() < now) {
      return { approved: false, expired: true };
    }
    if (!sess.claimed_at) {
      return { approved: false, expired: false };
    }
    const teacherName = sess.claimed_user?.display_name ?? sess.claimed_user?.email ?? null;
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, school_id: schoolId } });
    if (
      device?.pendingTakeoverUntil &&
      device.pendingTakeoverQrSessionId === sessionId &&
      device.pendingTakeoverUntil.getTime() > now
    ) {
      return {
        approved: false,
        expired: false,
        takeover_pending: true,
        takeover_seconds_left: Math.max(
          0,
          Math.ceil((device.pendingTakeoverUntil.getTime() - now) / 1000),
        ),
        teacher_name: teacherName,
      };
    }
    if (sess.exchanged_at) {
      return { approved: true, expired: false, exchanged: true, teacher_name: teacherName };
    }
    if (!sess.exchange_nonce || !sess.exchange_expires_at || sess.exchange_expires_at.getTime() < now) {
      return { approved: false, expired: true };
    }
    return {
      approved: true,
      expired: false,
      exchange_nonce: sess.exchange_nonce,
      exchange_expires_in: Math.max(0, Math.floor((sess.exchange_expires_at.getTime() - now) / 1000)),
      teacher_name: teacherName,
    };
  }

  /** Tahta (okul IP): tek kullanımlık exchange ile USB token — poll’da token dönülmez. */
  async exchangeQrUnlockToken(
    schoolId: string,
    deviceId: string,
    sessionId: string,
    exchangeNonce: string,
    clientIp: string,
  ): Promise<{ access_token: string; expires_in: number; teacher_name: string | null }> {
    this.assertTvEndpointRate(clientIp, 'qr_exchange', 30);
    const sess = await this.qrSessionRepo.findOne({
      where: { id: sessionId, school_id: schoolId, device_id: deviceId },
      relations: ['claimed_user'],
    });
    const now = Date.now();
    if (!sess || sess.expires_at.getTime() < now) {
      throw new UnauthorizedException({ code: 'QR_SESSION_INVALID', message: 'QR oturumu geçersiz veya süresi doldu.' });
    }
    if (!sess.claimed_at || !sess.claimed_user_id) {
      throw new UnauthorizedException({ code: 'QR_NOT_CLAIMED', message: 'Öğretmen onayı henüz yok.' });
    }
    if (sess.exchanged_at) {
      throw new BadRequestException({ code: 'QR_ALREADY_EXCHANGED', message: 'Token zaten alındı.' });
    }
    const nonce = (exchangeNonce || '').trim();
    if (!nonce || nonce !== sess.exchange_nonce) {
      throw new UnauthorizedException({ code: 'QR_EXCHANGE_INVALID', message: 'Geçersiz exchange kodu.' });
    }
    if (!sess.exchange_expires_at || sess.exchange_expires_at.getTime() < now) {
      throw new UnauthorizedException({ code: 'QR_EXCHANGE_EXPIRED', message: 'Exchange süresi doldu. Yeni QR oluşturun.' });
    }
    sess.exchanged_at = new Date();
    sess.exchange_nonce = null;
    sess.issued_usb_token_plain = null;
    await this.qrSessionRepo.save(sess);

    const issued = await this.issueTvUsbToken(schoolId, deviceId, sess.claimed_user_id);
    sess.issued_usb_token_hash = issued.token_hash;
    await this.qrSessionRepo.save(sess);

    const u = sess.claimed_user;
    return {
      access_token: issued.access_token,
      expires_in: issued.expires_in,
      teacher_name: u?.display_name ?? u?.email ?? null,
    };
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
    const staleHeartbeatMs = timeoutMin * 60 * 1000;
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
    options?: { releaseOtherOnDevice?: boolean },
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
      const teacherClassesSet = new Set(teacherClasses.map((c) => c.trim().toUpperCase()));
      const cs = device.classSection.trim().toUpperCase();
      if (!teacherClassesSet.has(cs)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Bu sınıfın tahtasına bağlanma yetkiniz yok. Sadece ders verdiğiniz sınıfların tahtalarına bağlanabilirsiniz.',
        });
      }
    }
    try {
      return await this.sessionRepo.manager.transaction(async (manager) => {
        const txDeviceRepo = manager.getRepository(SmartBoardDevice);
        const txSessionRepo = manager.getRepository(SmartBoardSession);
        const txUserRepo = manager.getRepository(User);

        // Aynı tahtaya paralel connect isteklerini serialize et.
        const lockedDevice = await txDeviceRepo
          .createQueryBuilder('d')
          .setLock('pessimistic_write')
          .where('d.id = :deviceId', { deviceId })
          .getOne();

        if (!lockedDevice) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
        }
        if (lockedDevice.school_id !== schoolId) {
          throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu cihaza erişim yetkiniz yok.' });
        }

        // Aynı öğretmenin paralel connect isteklerini de serialize et.
        await txUserRepo
          .createQueryBuilder('u')
          .setLock('pessimistic_write')
          .where('u.id = :userId', { userId })
          .getOne();

        const activeOnDevice = await txSessionRepo.findOne({
          where: { device_id: deviceId, disconnected_at: IsNull() },
          relations: ['user'],
        });
        if (activeOnDevice) {
          if (activeOnDevice.user_id === userId) {
            return { session_id: activeOnDevice.id };
          }
          if (options?.releaseOtherOnDevice) {
            const prevTeacherId = activeOnDevice.user_id;
            const prevSessionId = activeOnDevice.id;
            activeOnDevice.disconnected_at = new Date();
            await txSessionRepo.save(activeOnDevice);
            const devForNotify = lockedDevice;
            const newTeacherId = userId;
            setImmediate(() => {
              void this.notifySessionReplacedOnDevice(schoolId, devForNotify, prevTeacherId, newTeacherId, prevSessionId).catch(
                () => undefined,
              );
            });
          } else {
            throw new BadRequestException({
              code: 'DEVICE_BUSY',
              message: 'Bu tahta şu an başka bir öğretmen tarafından kullanılıyor.',
            });
          }
        }

        const activeForTeacher = await txSessionRepo.findOne({
          where: { user_id: userId, disconnected_at: IsNull() },
        });
        if (activeForTeacher && activeForTeacher.device_id !== deviceId) {
          throw new BadRequestException({
            code: 'TEACHER_ALREADY_CONNECTED',
            message: 'Öğretmenin aktif bir tahta oturumu var. Önce mevcut oturumu kapatın.',
          });
        }

        const now = new Date();
        const session = txSessionRepo.create({
          device_id: deviceId,
          user_id: userId,
          connected_at: now,
          last_heartbeat_at: now,
        });
        const saved = await txSessionRepo.save(session);
        lockedDevice.last_seen_at = now;
        lockedDevice.status = 'online';
        await txDeviceRepo.save(lockedDevice);
        return { session_id: saved.id };
      });
    } catch (e) {
      if (e instanceof QueryFailedError) {
        const code = (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
        if (code === '23505') {
          throw new BadRequestException({
            code: 'DEVICE_BUSY',
            message: 'Tahta oturumu başlatılırken çakışma oluştu. Tekrar deneyin.',
          });
        }
      }
      throw e;
    }
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

  /** QR veya PIN ile aynı tahtada yeni öğretmen bağlandığında önceki öğretmene bildirim. */
  private async notifySessionReplacedOnDevice(
    schoolId: string,
    device: SmartBoardDevice,
    previousTeacherId: string,
    newTeacherId: string,
    previousSessionId: string,
  ): Promise<void> {
    if (previousTeacherId === newTeacherId) return;
    try {
      const school = await this.schoolsService.findById(schoolId);
      if (school?.smartBoardNotifyOnQrTakeover === false) return;
      const newTeacher = await this.userRepo.findOne({
        where: { id: newTeacherId },
        select: ['display_name', 'email'],
      });
      const label = newTeacher?.display_name || newTeacher?.email || 'Başka bir öğretmen';
      await this.notificationsService.createInboxEntry({
        user_id: previousTeacherId,
        event_type: 'smart_board.replaced_on_device',
        entity_id: previousSessionId,
        target_screen: 'akilli-tahta',
        title: 'Tahta oturumunuz sonlandı',
        body: `${device.name} tahtasında ${label} bağlandı; ekran duyuru moduna döndü.`,
      });
    } catch {
      /* ignore */
    }
  }

  /** Heartbeat gelmeyen aktif oturumları kapat (dakikalık cron). */
  async disconnectStaleSessionsJob(): Promise<{ closed: number }> {
    const active = await this.sessionRepo.find({
      where: { disconnected_at: IsNull() },
      relations: ['device'],
    });
    const now = Date.now();
    const nowDate = new Date();
    let closed = 0;
    const schoolCache = new Map<string, { timeoutMin: number; school: School | null }>();
    for (const s of active) {
      const sid = s.device?.school_id;
      if (!sid) continue;
      let cached = schoolCache.get(sid);
      if (!cached) {
        const school = await this.schoolsService.findById(sid);
        cached = { timeoutMin: school?.smartBoardSessionTimeoutMinutes ?? 2, school };
        schoolCache.set(sid, cached);
      }
      const device = s.device;
      if (device && (await this.maybeAutoDisconnectForLessonEnd(cached.school, device, s, nowDate))) {
        closed++;
        continue;
      }
      const timeoutMin = cached.timeoutMin;
      const hb = s.last_heartbeat_at ?? s.connected_at;
      if (now - hb.getTime() <= timeoutMin * 60 * 1000) continue;
      s.disconnected_at = new Date();
      await this.sessionRepo.save(s);
      closed++;
      const device = s.device;
      if (device) {
        const hasOther = await this.sessionRepo.findOne({
          where: { device_id: device.id, disconnected_at: IsNull() },
        });
        if (!hasOther) {
          device.status = 'offline';
          await this.deviceRepo.save(device);
        }
      }
    }
    return { closed };
  }

  /** Tüm aktif tahta oturumlarını sonlandır (duyuru moduna dönüş). */
  async disconnectAllActiveSessionsForSchool(
    schoolId: string,
    actorUserId: string,
  ): Promise<{ ok: true; disconnected: number }> {
    const sessions = await this.sessionRepo
      .createQueryBuilder('s')
      .innerJoin('s.device', 'd')
      .where('d.school_id = :schoolId', { schoolId })
      .andWhere('s.disconnected_at IS NULL')
      .getMany();
    const now = new Date();
    for (const s of sessions) {
      s.disconnected_at = now;
      await this.sessionRepo.save(s);
    }
    const deviceIds = [...new Set(sessions.map((s) => s.device_id))];
    for (const deviceId of deviceIds) {
      const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
      if (!device) continue;
      const hasOther = await this.sessionRepo.findOne({
        where: { device_id: deviceId, disconnected_at: IsNull() },
      });
      if (!hasOther) {
        device.status = 'offline';
        await this.deviceRepo.save(device);
      }
    }
    await this.auditService.log({
      action: 'SMARTBOARD_DISCONNECT_ALL_ACTIVE',
      userId: actorUserId,
      schoolId,
      meta: { count: sessions.length },
    });
    return { ok: true, disconnected: sessions.length };
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
        const timeoutMin = school?.smartBoardSessionTimeoutMinutes ?? 2;
        const hb = session.last_heartbeat_at ?? session.connected_at;
        if (now.getTime() - hb.getTime() > timeoutMin * 60 * 1000) {
          await this.closeBoardAfterSchoolDay(session, device, now);
          return { ok: false };
        }
        if (await this.maybeAutoDisconnectForLessonEnd(school, device, session, now)) {
          return { ok: false };
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

  async bulkDeviceAction(
    deviceIds: string[],
    action: 'open' | 'lock' | 'close',
    scope: { schoolId: string | null; role: UserRole },
    actorUserId: string,
  ): Promise<{ ok: true; updated: number; results: Array<{ device_id: string; device_name: string | null; status: 'ok' | 'skipped'; message: string }> }> {
    if (scope.role !== UserRole.school_admin || !scope.schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const ids = Array.from(new Set((deviceIds ?? []).map((x) => String(x).trim()).filter(Boolean)));
    if (ids.length === 0) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'device_ids boş olamaz.' });
    }
    const devices = await this.deviceRepo.find({ where: { id: In(ids), school_id: scope.schoolId } });
    if (devices.length === 0) return { ok: true, updated: 0, results: [] };

    let updated = 0;
    const now = new Date();
    const results: Array<{ device_id: string; device_name: string | null; status: 'ok' | 'skipped'; message: string }> = [];
    const byId = new Map(devices.map((d) => [d.id, d]));
    for (const id of ids) {
      const d = byId.get(id);
      if (!d) {
        results.push({
          device_id: id,
          device_name: null,
          status: 'skipped',
          message: 'Cihaz bulunamadı veya bu okul kapsamı dışında.',
        });
        continue;
      }
      const activeSessions = await this.sessionRepo.find({
        where: { device_id: d.id, disconnected_at: IsNull() },
      });
      if (action === 'open') {
        d.status = 'online';
        d.last_seen_at = now;
        await this.deviceRepo.save(d);
        updated++;
        results.push({ device_id: d.id, device_name: d.name, status: 'ok', message: 'Tahta açıldı.' });
        continue;
      }

      for (const s of activeSessions) {
        s.disconnected_at = now;
        await this.sessionRepo.save(s);
      }
      d.status = action === 'close' ? 'offline' : 'online';
      await this.deviceRepo.save(d);
      updated++;
      results.push({
        device_id: d.id,
        device_name: d.name,
        status: 'ok',
        message: action === 'close' ? 'Tahta kapatıldı.' : 'Tahta kilitlendi (aktif oturum kapatıldı).',
      });
    }

    await this.auditService.log({
      action:
        action === 'open'
          ? 'SMARTBOARD_BULK_OPEN'
          : action === 'close'
            ? 'SMARTBOARD_BULK_CLOSE'
            : 'SMARTBOARD_BULK_LOCK',
      userId: actorUserId,
      schoolId: scope.schoolId,
      meta: { deviceIds: devices.map((d) => d.id), requestedCount: ids.length, updated, results },
    });

    return { ok: true, updated, results };
  }

  async getSmartBoardAuditLogs(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
    page: number,
    limit: number,
  ): Promise<{ total: number; page: number; limit: number; items: Array<{ id: string; action: string; created_at: Date; user: { display_name: string | null; email: string } | null; meta: Record<string, unknown> | null }> }> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const logs = await this.auditService.list({
      schoolId,
      page,
      limit: Math.min(100, Math.max(limit * 3, limit)),
    });
    const items = logs.items
      .filter((x) => String(x.action || '').startsWith('SMARTBOARD_'))
      .slice(0, limit)
      .map((x) => ({
        id: x.id,
        action: x.action,
        created_at: x.created_at,
        user: x.user ? { display_name: x.user.display_name ?? null, email: x.user.email } : null,
        meta: x.meta ?? null,
      }));
    return { total: logs.total, page, limit, items };
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

  private normalizeSetupCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private async generateUniqueSetupCode(): Promise<string> {
    for (let attempt = 0; attempt < 24; attempt++) {
      let code = '';
      const bytes = randomBytes(6);
      for (let i = 0; i < 6; i++) {
        code += SETUP_CODE_CHARS[bytes[i]! % SETUP_CODE_CHARS.length];
      }
      const exists = await this.schoolRepo.findOne({
        where: { smartBoardSetupCode: code },
        select: ['id'],
      });
      if (!exists) return code;
    }
    throw new BadRequestException({ code: 'SETUP_CODE_BUSY', message: 'Kurulum kodu üretilemedi, tekrar deneyin.' });
  }

  async ensureSchoolSetupCode(schoolId: string): Promise<string> {
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['id', 'smartBoardSetupCode'],
    });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    if (school.smartBoardSetupCode?.trim()) return school.smartBoardSetupCode.trim();
    const code = await this.generateUniqueSetupCode();
    school.smartBoardSetupCode = code;
    await this.schoolRepo.save(school);
    return code;
  }

  async regenerateSchoolSetupCode(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
    actorUserId: string,
  ): Promise<{ setup_code: string }> {
    if (scope.role !== UserRole.school_admin && scope.role !== UserRole.superadmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const code = await this.generateUniqueSetupCode();
    await this.schoolRepo.update({ id: schoolId }, { smartBoardSetupCode: code });
    await this.auditService.log({
      action: 'SMARTBOARD_SETUP_CODE_REGENERATED',
      userId: actorUserId,
      schoolId,
      meta: { setupCode: code },
    });
    return { setup_code: code };
  }

  private async schoolFromSetupCode(setupCode: string): Promise<School> {
    const code = this.normalizeSetupCode(setupCode);
    if (code.length < 4) {
      throw new BadRequestException({ code: 'INVALID_SETUP_CODE', message: 'Kurulum kodu geçersiz.' });
    }
    const school = await this.schoolRepo.findOne({ where: { smartBoardSetupCode: code } });
    if (!school) {
      throw new NotFoundException({ code: 'SETUP_CODE_NOT_FOUND', message: 'Kurulum kodu bulunamadı.' });
    }
    if (!this.isModuleEnabled(school)) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Bu okulda Akıllı Tahta modülü kapalı.' });
    }
    return school;
  }

  async resolveSchoolBySetupCode(setupCode: string): Promise<{ school_id: string; school_name: string; setup_code: string }> {
    const school = await this.schoolFromSetupCode(setupCode);
    return {
      school_id: school.id,
      school_name: school.name,
      setup_code: school.smartBoardSetupCode!.trim(),
    };
  }

  async getSetupPublicInfo(
    setupCode: string,
    clientIp: string,
  ): Promise<{
    school_id: string;
    school_name: string;
    setup_code: string;
    devices: Array<{ id: string; name: string; class_section: string | null }>;
    suggested_classes: string[];
  }> {
    this.assertTvEndpointRate(clientIp, 'setup_lookup', 80);
    const school = await this.schoolFromSetupCode(setupCode);
    const devices = await this.deviceRepo.find({
      where: { school_id: school.id },
      order: { classSection: 'ASC', name: 'ASC' },
    });
    let suggested_classes: string[] = [];
    try {
      suggested_classes = await this.timetableService.getDistinctClassSections(school.id);
    } catch {
      suggested_classes = [];
    }
    return {
      school_id: school.id,
      school_name: school.name,
      setup_code: school.smartBoardSetupCode!.trim(),
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        class_section: d.classSection,
      })),
      suggested_classes,
    };
  }

  private async createDeviceInternal(
    schoolId: string,
    opts: { name?: string; class_section?: string; room_or_location?: string },
    actorUserId?: string | null,
  ): Promise<SmartBoardDevice> {
    const pairingCode = randomBytes(4).toString('hex').toUpperCase();
    const device = this.deviceRepo.create({
      school_id: schoolId,
      pairing_code: pairingCode,
      name: opts.name?.trim() || 'Akıllı Tahta',
      roomOrLocation: opts.room_or_location?.trim() || null,
      classSection: opts?.class_section?.trim()
        ? normalizeClassSectionForStorage(opts.class_section) || null
        : null,
      status: 'offline',
    });
    const saved = await this.deviceRepo.save(device);
    await this.auditService.log({
      action: 'SMARTBOARD_DEVICE_CREATED',
      userId: actorUserId ?? null,
      schoolId,
      meta: {
        deviceId: saved.id,
        deviceName: saved.name,
        classSection: saved.classSection ?? null,
        via: 'setup',
      },
    });
    return saved;
  }

  async registerDeviceViaSetup(
    setupCode: string,
    body: {
      class_section?: string;
      room_or_location?: string;
      name?: string;
      device_id?: string;
      pairing_code?: string;
    },
    clientIp: string,
  ): Promise<{
    school_id: string;
    device_id: string;
    device_name: string;
    class_section: string | null;
    pairing_code: string;
    created: boolean;
  }> {
    this.assertTvEndpointRate(clientIp, 'setup_register', 40);
    const school = await this.schoolFromSetupCode(setupCode);

    if (body.device_id?.trim()) {
      const existing = await this.deviceRepo.findOne({
        where: { id: body.device_id.trim(), school_id: school.id },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'SETUP_DEVICE_SCOPE',
          message: 'Bu tahta seçilen okula ait değil.',
        });
      }
      const pairing = (body.pairing_code ?? '').trim().toUpperCase();
      const expected = (existing.pairing_code ?? '').trim().toUpperCase();
      if (!pairing || pairing !== expected) {
        throw new UnauthorizedException({
          code: 'PAIRING_CODE_INVALID',
          message: 'Etiket eşleştirme kodu hatalı. Yalnızca bu tahtanın etiketindeki kodu girin.',
        });
      }
      return {
        school_id: school.id,
        device_id: existing.id,
        device_name: existing.name,
        class_section: existing.classSection,
        pairing_code: existing.pairing_code,
        created: false,
      };
    }

    const classNorm = body.class_section?.trim();
    if (!classNorm) {
      throw new BadRequestException({
        code: 'INVALID_BODY',
        message: 'Sınıf seçin veya sınıf adı yazın.',
      });
    }
    const classKey = classNorm.toUpperCase();

    const all = await this.deviceRepo.find({ where: { school_id: school.id } });
    const match = all.find((d) => (d.classSection ?? '').trim().toUpperCase() === classKey);
    if (match) {
      return {
        school_id: school.id,
        device_id: match.id,
        device_name: match.name,
        class_section: match.classSection,
        pairing_code: match.pairing_code,
        created: false,
      };
    }

    const name = body.name?.trim() || `${classNorm} Akıllı Tahta`;
    const saved = await this.createDeviceInternal(
      school.id,
      {
        name,
        class_section: classNorm,
        room_or_location: body.room_or_location,
      },
      null,
    );
    return {
      school_id: school.id,
      device_id: saved.id,
      device_name: saved.name,
      class_section: saved.classSection,
      pairing_code: saved.pairing_code,
      created: true,
    };
  }

  async bulkCreateDevices(
    schoolId: string,
    role: UserRole,
    actorUserId: string,
    items: Array<{ class_section: string; name?: string; room_or_location?: string }>,
  ): Promise<{ created: SmartBoardDevice[]; skipped: string[]; errors: string[] }> {
    if (role !== UserRole.school_admin && role !== UserRole.superadmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const school = await this.schoolsService.findById(schoolId);
    if (!this.isModuleEnabled(school)) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Akıllı Tahta modülü kapalı.' });
    }
    const existing = await this.deviceRepo.find({ where: { school_id: schoolId } });
    const byClass = new Set(existing.map((d) => (d.classSection ?? '').trim().toUpperCase()).filter(Boolean));
    const created: SmartBoardDevice[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    for (const item of items ?? []) {
      const raw = item.class_section?.trim();
      if (!raw) continue;
      const cs = normalizeClassSectionForStorage(raw);
      if (!cs) {
        errors.push(`Geçersiz sınıf etiketi: "${raw.slice(0, 40)}${raw.length > 40 ? '…' : ''}"`);
        continue;
      }
      const key = cs.toUpperCase();
      if (byClass.has(key)) {
        skipped.push(cs);
        continue;
      }
      try {
        const saved = await this.createDeviceInternal(
          schoolId,
          {
            class_section: cs,
            name: item.name?.trim() || `${cs} Akıllı Tahta`,
            room_or_location: item.room_or_location,
          },
          actorUserId,
        );
        byClass.add(key);
        created.push(saved);
      } catch (e) {
        const label = raw.length > 48 ? `${raw.slice(0, 48)}…` : raw;
        if (e instanceof QueryFailedError) {
          errors.push(`Kaydedilemedi (${label}): veritabanı kısıtı`);
        } else if (e instanceof BadRequestException || e instanceof ForbiddenException) {
          const msg = (e.getResponse() as { message?: string })?.message;
          errors.push(`${label}: ${msg ?? 'reddedildi'}`);
        } else {
          errors.push(`Kaydedilemedi: ${label}`);
        }
      }
    }
    return { created, skipped, errors };
  }

  async getSetupStatus(
    schoolId: string,
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<{
    module_enabled: boolean;
    setup_code: string;
    device_count: number;
    online_count: number;
    never_seen_count: number;
    has_tv_ip: boolean;
    auto_authorize: boolean;
    authorized_teacher_count: number;
    qr_claimed_last_7d: boolean;
    checklist: Array<{ id: string; label: string; done: boolean; hint?: string }>;
  }> {
    if (scope.role === UserRole.school_admin && scope.schoolId !== schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const school = await this.schoolsService.findById(schoolId);
    const module_enabled = this.isModuleEnabled(school);
    const setup_code = await this.ensureSchoolSetupCode(schoolId);
    const devices = await this.deviceRepo.find({ where: { school_id: schoolId } });
    const now = Date.now();
    let online_count = 0;
    let never_seen_count = 0;
    for (const d of devices) {
      if (!d.last_seen_at) never_seen_count++;
      else if (now - d.last_seen_at.getTime() <= ONLINE_THRESHOLD_MS) online_count++;
      else if (d.status === 'online') online_count++;
    }
    const authCount = await this.authRepo.count({ where: { school_id: schoolId } });
    const logs = await this.auditService.list({ schoolId, page: 1, limit: 50 });
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const qr_claimed_last_7d = logs.items.some(
      (x) => x.action === 'SMARTBOARD_QR_SESSION_CLAIMED' && x.created_at >= weekAgo,
    );
    const has_tv_ip = !!(school.tv_allowed_ips?.trim());
    const auto_authorize = school.smartBoardAutoAuthorize ?? false;
    const checklist = [
      {
        id: 'module',
        label: 'Akıllı Tahta modülü açık',
        done: module_enabled,
        hint: module_enabled ? undefined : 'Okul modüllerinden smart_board etkinleştirin.',
      },
      {
        id: 'devices',
        label: 'En az bir tahta kayıtlı',
        done: devices.length > 0,
        hint: devices.length ? undefined : 'Kurulum sihirbazından sınıfları ekleyin.',
      },
      {
        id: 'online',
        label: 'En az bir tahta son 2 dk içinde görüldü',
        done: online_count > 0,
        hint: 'Tahtada classroom URL açık ve ağ bağlı olmalı.',
      },
      {
        id: 'teachers',
        label: 'Öğretmen yetkisi tanımlı',
        done: auto_authorize || authCount > 0,
        hint: 'Otomatik yetki veya yetkili öğretmen listesi.',
      },
      {
        id: 'qr_test',
        label: 'Son 7 günde QR ile açılış testi',
        done: qr_claimed_last_7d,
        hint: 'Öğretmen hesabından QR onayı ile tahta kullanım modunu test edin.',
      },
      {
        id: 'tv_ip',
        label: 'TV izinli IP tanımlı',
        done: has_tv_ip,
        hint: 'Canlıda kurulum için zorunlu. Ayarlar → TV izinli IP (okul ağı / VLAN).',
      },
    ];
    return {
      module_enabled,
      setup_code,
      device_count: devices.length,
      online_count,
      never_seen_count,
      has_tv_ip,
      auto_authorize,
      authorized_teacher_count: authCount,
      qr_claimed_last_7d,
      checklist,
    };
  }
}
