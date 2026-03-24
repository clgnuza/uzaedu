import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { SmartBoardDevice } from './entities/smart-board-device.entity';
import { SmartBoardDeviceSchedule } from './entities/smart-board-device-schedule.entity';
import { SmartBoardAuthorizedTeacher } from './entities/smart-board-authorized-teacher.entity';
import { SmartBoardSession } from './entities/smart-board-session.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, UserStatus } from '../types/enums';
import { SchoolsService } from '../schools/schools.service';
import { AuditService } from '../audit/audit.service';
import { TeacherTimetableService } from '../teacher-timetable/teacher-timetable.service';
import { NotificationsService } from '../notifications/notifications.service';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 dakika

@Injectable()
export class SmartBoardService {
  constructor(
    @InjectRepository(SmartBoardDevice)
    private readonly deviceRepo: Repository<SmartBoardDevice>,
    @InjectRepository(SmartBoardDeviceSchedule)
    private readonly scheduleRepo: Repository<SmartBoardDeviceSchedule>,
    @InjectRepository(SmartBoardAuthorizedTeacher)
    private readonly authRepo: Repository<SmartBoardAuthorizedTeacher>,
    @InjectRepository(SmartBoardSession)
    private readonly sessionRepo: Repository<SmartBoardSession>,
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
      currentLessonNum = this.getCurrentLessonNum(school?.lesson_schedule ?? null, now);
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
  ): Promise<{ id: string; user_id: string; display_name: string | null; email: string }[]> {
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
    }));
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
        if (school?.smartBoardAutoDisconnectLessonEnd && school.lesson_schedule?.length) {
          const lastLesson = school.lesson_schedule.reduce((a, b) =>
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
    const currentLessonNum = this.getCurrentLessonNum(school?.lesson_schedule ?? null, now);
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
