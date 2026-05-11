import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, EntityManager, Not, IsNull } from 'typeorm';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { School } from '../schools/entities/school.entity';
import { Student } from '../students/entities/student.entity';
import { SchoolClass } from '../classes-subjects/entities/school-class.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { ButterflyBuilding } from './entities/butterfly-building.entity';
import { ButterflyRoom } from './entities/butterfly-room.entity';
import { ButterflyExamPlan } from './entities/butterfly-exam-plan.entity';
import { ButterflySeatAssignment } from './entities/butterfly-seat-assignment.entity';
import { ButterflyExamProctor } from './entities/butterfly-exam-proctor.entity';
import { ButterflyModuleTeacher } from './entities/butterfly-module-teacher.entity';
import { CreateButterflyBuildingDto } from './dto/create-building.dto';
import { CreateButterflyRoomDto } from './dto/create-room.dto';
import { CreateButterflyExamPlanDto } from './dto/create-plan.dto';
import { UpdateButterflyExamPlanDto } from './dto/update-plan.dto';
import { mergeButterflyRules, type ButterflyExamRules } from './butterfly-exam-rules.types';
import { computeSeating, butterflySlotKey, type RoomSpec } from './butterfly-seating.engine';
import { ButterflyExamPdfService } from './butterfly-exam-pdf.service';
import { previewEokulStyleSheet } from './butterfly-eokul-xlsx.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ButterflyExamService {
  constructor(
    @InjectRepository(ButterflyBuilding)
    private readonly buildingRepo: Repository<ButterflyBuilding>,
    @InjectRepository(ButterflyRoom)
    private readonly roomRepo: Repository<ButterflyRoom>,
    @InjectRepository(ButterflyExamPlan)
    private readonly planRepo: Repository<ButterflyExamPlan>,
    @InjectRepository(ButterflySeatAssignment)
    private readonly seatRepo: Repository<ButterflySeatAssignment>,
    @InjectRepository(ButterflyExamProctor)
    private readonly proctorRepo: Repository<ButterflyExamProctor>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(SchoolClass)
    private readonly classRepo: Repository<SchoolClass>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ButterflyModuleTeacher)
    private readonly moduleTeacherRepo: Repository<ButterflyModuleTeacher>,
    private readonly pdf: ButterflyExamPdfService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getParticipantStudents(schoolId: string, rules: ButterflyExamRules): Promise<Student[]> {
    let base: Student[] = [];
    if (rules.participantMode === 'students' && rules.participantStudentIds?.length) {
      base = await this.studentRepo.find({ where: { schoolId, id: In(rules.participantStudentIds) } });
    } else if (rules.participantMode === 'classes' && rules.participantClassIds?.length) {
      base = await this.studentRepo.find({ where: { schoolId, classId: In(rules.participantClassIds) } });
    } else {
      base = await this.studentRepo.find({ where: { schoolId } });
    }
    const pinIds = [
      ...new Set([
        ...(rules.pinnedSeats ?? []).map((p) => p.studentId),
        ...(rules.pinnedStudentIds ?? []),
      ]),
    ];
    if (!pinIds.length) return base;
    const extra = await this.studentRepo.find({ where: { schoolId, id: In(pinIds) } });
    const m = new Map(base.map((s) => [s.id, s]));
    for (const e of extra) m.set(e.id, e);
    return [...m.values()];
  }

  async listBuildings(schoolId: string) {
    return this.buildingRepo.find({
      where: { schoolId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createBuilding(schoolId: string, dto: CreateButterflyBuildingDto) {
    const b = this.buildingRepo.create({
      schoolId,
      name: dto.name.trim(),
      sortOrder: dto.sort_order ?? 0,
    });
    return this.buildingRepo.save(b);
  }

  async updateBuilding(schoolId: string, id: string, dto: Partial<CreateButterflyBuildingDto>) {
    const b = await this.buildingRepo.findOne({ where: { id, schoolId } });
    if (!b) throw new NotFoundException();
    if (dto.name !== undefined) b.name = dto.name.trim();
    if (dto.sort_order !== undefined) b.sortOrder = dto.sort_order;
    return this.buildingRepo.save(b);
  }

  async deleteBuilding(schoolId: string, id: string) {
    const b = await this.buildingRepo.findOne({ where: { id, schoolId } });
    if (!b) throw new NotFoundException();
    await this.buildingRepo.remove(b);
    return { success: true };
  }

  async listRooms(schoolId: string) {
    const rooms = await this.roomRepo.find({
      where: { schoolId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const buildingIds = [...new Set(rooms.map((r) => r.buildingId))];
    const buildings = buildingIds.length
      ? await this.buildingRepo.find({ where: { id: In(buildingIds), schoolId } })
      : [];
    const bMap = new Map(buildings.map((x) => [x.id, x.name]));
    return rooms.map((r) => ({
      ...r,
      buildingName: bMap.get(r.buildingId) ?? '',
    }));
  }

  async createRoom(schoolId: string, dto: CreateButterflyRoomDto) {
    const b = await this.buildingRepo.findOne({ where: { id: dto.building_id, schoolId } });
    if (!b) throw new BadRequestException({ code: 'INVALID_BUILDING', message: 'Bina bulunamadı.' });
    const r = this.roomRepo.create({
      schoolId,
      buildingId: dto.building_id,
      name: dto.name.trim(),
      capacity: dto.capacity,
      seatLayout: dto.seat_layout ?? 'pair',
      sortOrder: dto.sort_order ?? 0,
    });
    return this.roomRepo.save(r);
  }

  /**
   * Her okul şubesi için aynı adda sınav salonu yoksa oluşturur (Kertenkele yerleştirme ile eşleşir).
   * Bina: "Sınav salonları" (yoksa eklenir). Kapasite = şube öğrenci sayısı; oturma grupları ikili+tek satırlarla tam eşler (0 öğrenci: 1 koltuk). Sonradan PATCH ile düzenlenebilir.
   */
  private layoutGroupsForSeatCount(n: number): { rowType: 'pair' | 'single'; rowCount: number }[] {
    const cap = n < 1 ? 1 : n;
    const pairRows = Math.floor(cap / 2);
    const rem = cap % 2;
    const groups: { rowType: 'pair' | 'single'; rowCount: number }[] = [];
    if (pairRows > 0) groups.push({ rowType: 'pair', rowCount: pairRows });
    if (rem > 0) groups.push({ rowType: 'single', rowCount: rem });
    return groups;
  }

  async ensureClassExamRooms(schoolId: string): Promise<{ created: number; skipped: number; classCount: number }> {
    const classes = await this.classRepo.find({
      where: { schoolId },
      order: { grade: 'ASC', section: 'ASC', name: 'ASC' },
    });
    if (!classes.length) return { created: 0, skipped: 0, classCount: 0 };

    const buildings = await this.buildingRepo.find({ where: { schoolId }, order: { sortOrder: 'ASC', name: 'ASC' } });
    let examBuilding = buildings.find((b) => b.name.trim().toLowerCase() === 'sınav salonları');
    if (!examBuilding) {
      const sortOrder = buildings.reduce((m, b) => Math.max(m, b.sortOrder ?? 0), -1) + 1;
      examBuilding = await this.buildingRepo.save(
        this.buildingRepo.create({ schoolId, name: 'Sınav salonları', sortOrder }),
      );
    }

    const rooms = await this.roomRepo.find({ where: { schoolId } });
    const taken = new Set(rooms.map((r) => r.name.trim().toLowerCase()));
    let nextSort = rooms.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), -1) + 1;
    let created = 0;

    for (const cls of classes) {
      const nm = cls.name.trim();
      const key = nm.toLowerCase();
      if (!nm || taken.has(key)) continue;

      const studentCount = await this.studentRepo.count({ where: { schoolId, classId: cls.id } });
      const layoutGroups = this.layoutGroupsForSeatCount(studentCount);
      const totalFromGroups = layoutGroups.reduce(
        (s, g) => s + (g.rowType === 'pair' ? g.rowCount * 2 : g.rowCount),
        0,
      );

      const r = this.roomRepo.create({
        schoolId,
        buildingId: examBuilding.id,
        name: nm,
        capacity: totalFromGroups,
        seatLayout: JSON.stringify(layoutGroups),
        sortOrder: nextSort++,
      });
      await this.roomRepo.save(r);
      taken.add(key);
      created++;
    }

    return { created, skipped: classes.length - created, classCount: classes.length };
  }

  async updateRoom(
    schoolId: string,
    id: string,
    dto: Partial<Pick<CreateButterflyRoomDto, 'building_id' | 'name' | 'capacity' | 'seat_layout' | 'sort_order'>> & {
      layoutGroups?: Array<{ rowType: 'pair' | 'single'; rowCount: number }>;
    },
  ) {
    const r = await this.roomRepo.findOne({ where: { id, schoolId } });
    if (!r) throw new NotFoundException();
    if (dto.building_id !== undefined) {
      const b = await this.buildingRepo.findOne({ where: { id: dto.building_id, schoolId } });
      if (!b) throw new BadRequestException({ code: 'INVALID_BUILDING', message: 'Bina bulunamadı.' });
      r.buildingId = dto.building_id;
    }
    if (dto.name !== undefined) r.name = dto.name.trim();
    if (dto.capacity !== undefined) r.capacity = dto.capacity;
    if (dto.layoutGroups !== undefined) {
      // Kapasite gruplardan hesapla ve layoutGroups'u JSON'a serialize et
      const groups = dto.layoutGroups.filter((g) => g.rowCount > 0);
      const totalCapacity = groups.reduce((s, g) => s + (g.rowType === 'pair' ? g.rowCount * 2 : g.rowCount), 0);
      r.seatLayout = JSON.stringify(groups);
      r.capacity = totalCapacity;
    } else if (dto.seat_layout !== undefined) {
      r.seatLayout = dto.seat_layout;
    }
    if (dto.sort_order !== undefined) r.sortOrder = dto.sort_order;
    return this.roomRepo.save(r);
  }

  async deleteRoom(schoolId: string, id: string) {
    const r = await this.roomRepo.findOne({ where: { id, schoolId } });
    if (!r) throw new NotFoundException();
    await this.roomRepo.remove(r);
    return { success: true };
  }

  async listPlans(schoolId: string) {
    return this.planRepo.find({
      where: { schoolId },
      order: { examStartsAt: 'DESC' },
    });
  }

  async getPlan(schoolId: string, id: string) {
    const p = await this.planRepo.findOne({ where: { id, schoolId } });
    if (!p) throw new NotFoundException();
    return p;
  }

  async createPlan(schoolId: string, userId: string | null, dto: CreateButterflyExamPlanDto) {
    const p = this.planRepo.create({
      schoolId,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
      examStartsAt: new Date(dto.exam_starts_at),
      examEndsAt: dto.exam_ends_at ? new Date(dto.exam_ends_at) : null,
      status: 'draft',
      rules: dto.rules ?? {},
      createdByUserId: userId,
    });
    return this.planRepo.save(p);
  }

  async updatePlan(schoolId: string, id: string, dto: UpdateButterflyExamPlanDto) {
    const p = await this.planRepo.findOne({ where: { id, schoolId } });
    if (!p) throw new NotFoundException();
    if (dto.title !== undefined) p.title = dto.title.trim();
    if (dto.description !== undefined) p.description = dto.description;
    if (dto.exam_starts_at !== undefined) p.examStartsAt = new Date(dto.exam_starts_at);
    if (dto.exam_ends_at !== undefined) p.examEndsAt = dto.exam_ends_at ? new Date(dto.exam_ends_at) : null;
    if (dto.status !== undefined) p.status = dto.status;
    if (dto.rules !== undefined) p.rules = { ...p.rules, ...dto.rules };
    return this.planRepo.save(p);
  }

  async generateSeatAssignments(schoolId: string, planId: string) {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    if (plan.status === 'archived') {
      throw new BadRequestException({ code: 'PLAN_ARCHIVED', message: 'Arşivlenmiş oturuma atama yapılamaz.' });
    }
    const rules = mergeButterflyRules(plan.rules as Record<string, unknown>);

    const buildings = await this.buildingRepo.find({ where: { schoolId }, order: { sortOrder: 'ASC' } });
    const bOrder = new Map(buildings.map((x, i) => [x.id, i]));
    let rooms = await this.roomRepo.find({ where: { schoolId } });
    if (rules.roomIds?.length) {
      const allow = new Set(rules.roomIds);
      rooms = rooms.filter((r) => allow.has(r.id));
    }
    if (!rooms.length) {
      throw new BadRequestException({
        code: 'NO_ROOMS',
        message: 'Bu oturum için salon seçilmedi veya seçilen salonlar geçersiz.',
      });
    }
    rooms.sort((a, b) => {
      const ba = bOrder.get(a.buildingId) ?? 0;
      const bb = bOrder.get(b.buildingId) ?? 0;
      if (ba !== bb) return ba - bb;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, 'tr');
    });

    const roomSpecs: RoomSpec[] = rooms.map((r) => ({
      id: r.id,
      capacity: r.capacity,
      seatLayout: r.seatLayout,
      name: r.name,
    }));
    const totalCap = roomSpecs.reduce((s, r) => s + r.capacity, 0);
    const students = await this.getParticipantStudents(schoolId, rules);
    if (students.length > totalCap) {
      throw new BadRequestException({
        code: 'CAPACITY',
        message: `Salon kapasitesi yetersiz: ${students.length} öğrenci, ${totalCap} koltuk.`,
      });
    }

    const preset = new Map<string, string>();
    const lockedRows = await this.seatRepo.find({ where: { planId: plan.id, locked: true } });
    for (const row of lockedRows) {
      preset.set(butterflySlotKey(row.roomId, row.seatIndex), row.studentId);
    }
    for (const pin of rules.pinnedSeats ?? []) {
      preset.set(butterflySlotKey(pin.roomId, pin.seatIndex), pin.studentId);
    }

    const fixedClassRoomIds = new Map<string, Set<string>>();
    if (rules.fixedClassIds?.length) {
      const fixedClasses = await this.classRepo.find({
        where: { schoolId, id: In(rules.fixedClassIds) },
      });
      for (const c of fixedClasses) {
        const key = c.name.trim().toLowerCase();
        const ids = rooms.filter((rr) => rr.name.trim().toLowerCase() === key).map((rr) => rr.id);
        if (ids.length) fixedClassRoomIds.set(c.id, new Set(ids));
      }
    }

    const seatingStudents = students.map((s) => ({
      id: s.id,
      classId: s.classId ?? null,
      name: s.name,
      studentNumber: s.studentNumber,
      gender: s.gender,
    }));
    const result = computeSeating(roomSpecs, seatingStudents, rules, new Map(), preset, { fixedClassRoomIds });

    const pinLockSet = new Set(rules.pinnedStudentIds ?? []);
    const lockPinned = rules.lockPinnedAssignments === true;

    await this.seatRepo.manager.transaction(async (em) => {
      await em.delete(ButterflySeatAssignment, { planId: plan.id, locked: false });
      const lockedKeys = new Set(lockedRows.map((r) => butterflySlotKey(r.roomId, r.seatIndex)));
      for (const [k, studentId] of result.assignment) {
        if (lockedKeys.has(k)) continue;
        const colon = k.lastIndexOf(':');
        const roomId = k.slice(0, colon);
        const seatIndex = parseInt(k.slice(colon + 1), 10);
        const row = em.create(ButterflySeatAssignment, {
          planId: plan.id,
          studentId,
          roomId,
          seatIndex,
          locked: lockPinned && pinLockSet.has(studentId),
          isManual: false,
        });
        await em.save(ButterflySeatAssignment, row);
      }
      await this.replaceAutoProctorsInTx(em, schoolId, plan.id, roomSpecs, result.assignment, rules);
    });

    return {
      assignments: await this.listAssignments(schoolId, planId),
      violations: result.violations,
    };
  }

  /**
   * Otomatik gözetmen: `proctorMode === 'auto'` iken mevcut gözetmen kayıtlarını silip
   * modül öğretmenleri (yoksa okul öğretmenleri) üzerinden salon başına atama yapar.
   */
  private async replaceAutoProctorsInTx(
    em: EntityManager,
    schoolId: string,
    planId: string,
    roomSpecs: RoomSpec[],
    assignment: Map<string, string>,
    rules: ButterflyExamRules,
  ): Promise<void> {
    if (rules.proctorMode !== 'auto') return;

    const usedRoomIds = new Set<string>();
    for (const k of assignment.keys()) {
      const colon = k.lastIndexOf(':');
      usedRoomIds.add(k.slice(0, colon));
    }
    if (!usedRoomIds.size) return;

    const perRoom = Math.max(1, Math.min(10, rules.proctorsPerRoom ?? 2));
    const modTeachers = await em.find(ButterflyModuleTeacher, { where: { schoolId } });
    let pool = modTeachers.map((m) => m.userId);
    if (!pool.length) {
      // Tüm öğretmenleri kullan (sınırı kaldırdık)
      const teachers = await em.find(User, {
        where: { school_id: schoolId, role: UserRole.teacher },
      });
      pool = teachers.map((u) => u.id);
    }
    if (!pool.length) return;

    // Çakışan oturumlarda bu plan ile aynı zaman aralığını paylaşan başka planların
    // gözetmenlerini tespit edip havuzdan dışla. (overlap: startA < endB && startB < endA)
    const currentPlan = await em.findOne(ButterflyExamPlan, { where: { id: planId, schoolId } });
    const busyIds = new Set<string>();
    if (currentPlan) {
      const start = currentPlan.examStartsAt;
      // Bitiş yoksa varsayılan 2 saatlik blok say
      const end = currentPlan.examEndsAt ?? new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const otherPlans = await em
        .createQueryBuilder(ButterflyExamPlan, 'p')
        .where('p.school_id = :sid', { sid: schoolId })
        .andWhere('p.id <> :pid', { pid: planId })
        .andWhere('p.exam_starts_at < :end', { end })
        .andWhere('COALESCE(p.exam_ends_at, p.exam_starts_at + interval \'2 hours\') > :start', { start })
        .select(['p.id'])
        .getMany();
      const otherIds = otherPlans.map((p) => p.id);
      if (otherIds.length) {
        const busyProctors = await em.find(ButterflyExamProctor, { where: { planId: In(otherIds) } });
        for (const bp of busyProctors) busyIds.add(bp.userId);
      }
    }

    // Çakışmayan havuzu önce kullan; yetmezse çakışanlardan tamamla.
    const freePool = pool.filter((id) => !busyIds.has(id));
    const fallbackPool = pool.filter((id) => busyIds.has(id));
    const orderedPool = freePool.length ? [...freePool, ...fallbackPool] : pool;
    if (!orderedPool.length) return;

    await em.delete(ButterflyExamProctor, { planId });
    const roomOrder = [...roomSpecs.map((r) => r.id)].filter((id) => usedRoomIds.has(id));
    let uidx = 0;
    let sortOrder = 0;
    for (const roomId of roomOrder) {
      const used = new Set<string>();
      for (let k = 0; k < perRoom; k++) {
        let userId = orderedPool[uidx % orderedPool.length]!;
        let guard = 0;
        while (used.has(userId) && guard++ < orderedPool.length * 2) {
          uidx++;
          userId = orderedPool[uidx % orderedPool.length]!;
        }
        used.add(userId);
        uidx++;
        const row = em.create(ButterflyExamProctor, {
          planId,
          roomId,
          userId,
          label: null,
          sortOrder: sortOrder++,
        });
        await em.save(ButterflyExamProctor, row);
      }
    }
  }

  async listAssignments(schoolId: string, planId: string, opts?: { forTeacher?: boolean }) {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    if (opts?.forTeacher && plan.status === 'draft') {
      throw new ForbiddenException({ message: 'Taslak oturum görüntülenemez.' });
    }
    const rows = await this.seatRepo.find({
      where: { planId },
      order: { roomId: 'ASC', seatIndex: 'ASC' },
    });
    const studentIds = rows.map((r) => r.studentId);
    const roomIds = [...new Set(rows.map((r) => r.roomId))];
    const students = studentIds.length
      ? await this.studentRepo.find({ where: { id: In(studentIds), schoolId } })
      : [];
    const sMap = new Map(students.map((s) => [s.id, s]));
    const rooms = roomIds.length ? await this.roomRepo.find({ where: { id: In(roomIds), schoolId } }) : [];
    const rMap = new Map(rooms.map((r) => [r.id, r]));
    const buildingIds = [...new Set(rooms.map((r) => r.buildingId))];
    const buildings = buildingIds.length
      ? await this.buildingRepo.find({ where: { id: In(buildingIds), schoolId } })
      : [];
    const bdMap = new Map(buildings.map((b) => [b.id, b.name]));
    const classIds = [...new Set(students.map((s) => s.classId).filter(Boolean))] as string[];
    const classes = classIds.length ? await this.classRepo.find({ where: { id: In(classIds) } }) : [];
    const cMap = new Map(classes.map((c) => [c.id, c]));

    return rows.map((row) => {
      const st = sMap.get(row.studentId);
      const room = rMap.get(row.roomId);
      const c = st?.classId ? cMap.get(st.classId) : null;
      const classLabel = c?.name ?? '';
      return {
        id: row.id,
        studentId: row.studentId,
        studentName: st?.name ?? '',
        studentNumber: st?.studentNumber ?? null,
        classId: st?.classId ?? null,
        classLabel,
        roomId: row.roomId,
        roomName: room?.name ?? '',
        buildingName: room ? bdMap.get(room.buildingId) ?? '' : '',
        seatIndex: row.seatIndex,
        seatLabel: String(row.seatIndex + 1),
        locked: row.locked,
        isManual: row.isManual,
      };
    });
  }

  async moveAssignment(schoolId: string, assignmentId: string, roomId: string, seatIndex: number) {
    const row = await this.seatRepo.findOne({ where: { id: assignmentId } });
    if (!row) throw new NotFoundException();
    const plan = await this.planRepo.findOne({ where: { id: row.planId, schoolId } });
    if (!plan) throw new NotFoundException();
    if (row.locked) {
      throw new BadRequestException({ code: 'LOCKED', message: 'Kilitli koltuk taşınamaz.' });
    }
    const room = await this.roomRepo.findOne({ where: { id: roomId, schoolId } });
    if (!room) throw new BadRequestException({ code: 'ROOM', message: 'Salon bulunamadı.' });
    if (seatIndex < 0 || seatIndex >= room.capacity) {
      throw new BadRequestException({ code: 'SEAT', message: 'Geçersiz sıra.' });
    }
    const other = await this.seatRepo.findOne({ where: { planId: row.planId, roomId, seatIndex } });
    await this.seatRepo.manager.transaction(async (em) => {
      if (!other) {
        await em.update(ButterflySeatAssignment, { id: row.id }, { roomId, seatIndex, isManual: true });
        return;
      }
      if (other.locked) {
        throw new BadRequestException({ code: 'TARGET_LOCKED', message: 'Hedef koltuk kilitli.' });
      }
      const tRoom = row.roomId;
      const tSeat = row.seatIndex;
      await em.update(ButterflySeatAssignment, { id: row.id }, { roomId: other.roomId, seatIndex: other.seatIndex, isManual: true });
      await em.update(ButterflySeatAssignment, { id: other.id }, { roomId: tRoom, seatIndex: tSeat, isManual: true });
    });
    return this.listAssignments(schoolId, row.planId);
  }

  async setAssignmentLock(schoolId: string, assignmentId: string, locked: boolean) {
    const row = await this.seatRepo.findOne({ where: { id: assignmentId } });
    if (!row) throw new NotFoundException();
    const plan = await this.planRepo.findOne({ where: { id: row.planId, schoolId } });
    if (!plan) throw new NotFoundException();
    await this.seatRepo.update({ id: assignmentId }, { locked });
    return { success: true, locked };
  }

  async listProctors(schoolId: string, planId: string) {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    const rows = await this.proctorRepo.find({ where: { planId }, order: { sortOrder: 'ASC' } });
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = userIds.length ? await this.userRepo.find({ where: { id: In(userIds) } }) : [];
    const uMap = new Map(users.map((u) => [u.id, u.display_name ?? u.email]));
    const roomIds = [...new Set(rows.map((r) => r.roomId))];
    const rooms = roomIds.length ? await this.roomRepo.find({ where: { id: In(roomIds), schoolId } }) : [];
    const rMap = new Map(rooms.map((r) => [r.id, r.name]));
    return rows.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      roomName: rMap.get(r.roomId) ?? '',
      userId: r.userId,
      displayName: uMap.get(r.userId) ?? '',
      label: r.label,
      sortOrder: r.sortOrder,
    }));
  }

  async setProctors(schoolId: string, planId: string, proctors: Array<{ room_id: string; user_id: string; label?: string | null; sort_order?: number }>) {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    const roomIds = [...new Set(proctors.map((p) => p.room_id))];
    if (roomIds.length) {
      const n = await this.roomRepo.count({ where: { schoolId, id: In(roomIds) } });
      if (n !== roomIds.length) throw new BadRequestException({ code: 'ROOM', message: 'Geçersiz salon.' });
    }
    for (const p of proctors) {
      const u = await this.userRepo.findOne({ where: { id: p.user_id } });
      if (!u || u.role !== UserRole.teacher || u.school_id !== schoolId) {
        throw new BadRequestException({ code: 'USER', message: 'Yalnızca bu okuldaki öğretmen seçilebilir.' });
      }
    }

    const existingProctors = await this.proctorRepo.find({ where: { planId } });
    const existingUserIds = new Set(existingProctors.map((p) => p.userId));

    await this.proctorRepo.manager.transaction(async (em) => {
      await em.delete(ButterflyExamProctor, { planId });
      let i = 0;
      for (const p of proctors) {
        const e = em.create(ButterflyExamProctor, {
          planId,
          roomId: p.room_id,
          userId: p.user_id,
          label: p.label ?? null,
          sortOrder: p.sort_order ?? i++,
        });
        await em.save(e);
      }
    });

    const newlyAssignedUserIds = [...new Set(proctors.map((p) => p.user_id))].filter(
      (id) => !existingUserIds.has(id),
    );
    for (const userId of newlyAssignedUserIds) {
      await this.notificationsService.createInboxEntry({
        user_id: userId,
        event_type: 'butterfly_exam.proctor_assigned',
        entity_id: planId,
        target_screen: '/kelebek-sinav/sinav-islemleri',
        title: 'Sınav görevi atandı',
        body: `"${plan.title}" sınavı için gözetmen olarak atandınız.`,
        metadata: { plan_id: planId, school_id: schoolId },
      });
    }

    return this.listProctors(schoolId, planId);
  }

  async buildSalonPdf(schoolId: string, planId: string, roomId: string): Promise<Uint8Array> {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const room = await this.roomRepo.findOne({ where: { id: roomId, schoolId } });
    if (!room) throw new NotFoundException();
    const building = await this.buildingRepo.findOne({ where: { id: room.buildingId, schoolId } });
    const rows = await this.listAssignments(schoolId, planId);
    const filtered = rows.filter((r) => r.roomId === roomId).sort((a, b) => a.seatIndex - b.seatIndex);
    const merged = mergeButterflyRules(plan.rules as Record<string, unknown>);
    const subtitle: string[] = [];
    if (merged.subjectLabel) subtitle.push(`Ders / sınav: ${merged.subjectLabel}`);
    if (merged.lessonPeriodLabel) subtitle.push(`Saat / ders: ${merged.lessonPeriodLabel}`);
    return this.pdf.buildSalonAttendancePdf({
      title: plan.title,
      schoolName: school?.name ?? '',
      roomName: room.name,
      buildingName: building?.name ?? '',
      examStartsAt: plan.examStartsAt,
      subtitleLines: subtitle.length ? subtitle : undefined,
      footerLines: merged.reportFooterLines?.length ? merged.reportFooterLines : undefined,
      rows: filtered.map((r) => ({
        studentName: r.studentName,
        classLabel: r.classLabel,
        seatLabel: r.seatLabel,
        studentNumber: r.studentNumber,
      })),
    });
  }

  async buildExamPaperLabelsPdf(schoolId: string, planId: string, roomId?: string): Promise<Uint8Array> {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const merged = mergeButterflyRules(plan.rules as Record<string, unknown>);
    const allAssignments = await this.listAssignments(schoolId, planId);
    const filtered = roomId ? allAssignments.filter((a) => a.roomId === roomId) : allAssignments;

    // group by room
    const roomMap = new Map<string, { roomId: string; roomName: string; buildingName: string; students: typeof filtered }>();
    for (const a of filtered.sort((x, y) => x.seatIndex - y.seatIndex)) {
      if (!roomMap.has(a.roomId)) {
        const room = await this.roomRepo.findOne({ where: { id: a.roomId } });
        const building = room?.buildingId ? await this.buildingRepo.findOne({ where: { id: room.buildingId } }) : null;
        roomMap.set(a.roomId, { roomId: a.roomId, roomName: room?.name ?? a.roomId, buildingName: building?.name ?? '', students: [] });
      }
      roomMap.get(a.roomId)!.students.push(a);
    }

    const subjectAssignments = (merged as Record<string, unknown>).classSubjectAssignments as Array<{ classId: string; subjectName: string }> | undefined;
    const examPaperConfig = ((plan.rules as Record<string, unknown>)?.examPaperConfig as Record<string, unknown> | undefined);
    const uploadedPapers = ((plan.rules as Record<string, unknown>)?.uploadedPapers as Array<Record<string, unknown>>) ?? [];

    // Ders bazlı PDF tampon haritası — her öğrenci kendi dersinin kağıdını alsın
    const examPdfBySubject: Record<string, Buffer> = {};
    let fallbackPdfBuffer: Buffer | undefined;
    for (const paper of uploadedPapers) {
      const fp = paper.filePath as string | undefined;
      const subj = ((paper.subjectName as string | undefined) ?? '').trim();
      if (!fp || !existsSync(fp)) continue;
      const buf = readFileSync(fp);
      if (subj) examPdfBySubject[subj] = buf;
      if (!fallbackPdfBuffer) fallbackPdfBuffer = buf;
    }

    return this.pdf.buildExamPaperLabelsPdf({
      planTitle: plan.title,
      schoolName: school?.name ?? '',
      examStartsAt: plan.examStartsAt,
      subjectLabel: merged.subjectLabel,
      qrCorner: examPaperConfig?.qrCorner as 'tl' | 'tr' | 'bl' | 'br' | undefined,
      examPdfBuffer: fallbackPdfBuffer,
      examPdfBySubject,
      rooms: [...roomMap.values()].map((r) => ({
        roomName: r.roomName,
        buildingName: r.buildingName,
        students: r.students.map((s) => ({
          studentName: s.studentName,
          studentNumber: s.studentNumber,
          classLabel: s.classLabel,
          seatLabel: s.seatLabel,
          subjectName: subjectAssignments?.find((sa) => sa.classId === s.classId)?.subjectName,
        })),
      })),
    });
  }

  async listModuleTeachers(schoolId: string) {
    const rows = await this.moduleTeacherRepo.find({ where: { schoolId }, order: { createdAt: 'ASC' } });
    const userIds = rows.map((r) => r.userId);
    if (!userIds.length) return [];
    const users = await this.userRepo.find({ where: { id: In(userIds) } });
    const uMap = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = uMap.get(r.userId);
      return { id: r.id, userId: r.userId, display_name: u?.display_name ?? null, email: u?.email ?? '' };
    });
  }

  async addModuleTeacher(schoolId: string, userId: string) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u || u.role !== UserRole.teacher || u.school_id !== schoolId) {
      throw new BadRequestException({ code: 'USER', message: 'Yalnızca bu okuldaki öğretmen eklenebilir.' });
    }
    const existing = await this.moduleTeacherRepo.findOne({ where: { schoolId, userId } });
    if (existing) return { id: existing.id, userId, display_name: u.display_name, email: u.email };
    const row = this.moduleTeacherRepo.create({ schoolId, userId });
    await this.moduleTeacherRepo.save(row);
    return { id: row.id, userId, display_name: u.display_name, email: u.email };
  }

  async removeModuleTeacher(schoolId: string, userId: string) {
    await this.moduleTeacherRepo.delete({ schoolId, userId });
  }

  async registerUploadedPaper(schoolId: string, planId: string, subjectName: string, filename: string, size: number, buffer?: Buffer) {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    const rules = (plan.rules as Record<string, unknown>) ?? {};
    const existing = (rules.uploadedPapers as Array<Record<string, unknown>>) ?? [];
    const filtered = existing.filter((p) => p.subjectName !== subjectName);

    let filePath: string | undefined;
    if (buffer?.length) {
      const uploadDir = join(process.cwd(), 'uploads', 'butterfly-papers');
      mkdirSync(uploadDir, { recursive: true });
      const safeSubject = subjectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      filePath = join(uploadDir, `${planId}_${safeSubject}.pdf`);
      writeFileSync(filePath, buffer);
    } else {
      const prev = existing.find((p) => p.subjectName === subjectName);
      filePath = prev?.filePath as string | undefined;
    }

    filtered.push({ subjectName, filename, size, uploadedAt: new Date().toISOString(), filePath });
    await this.planRepo.update({ id: planId, schoolId }, {
      rules: { ...rules, uploadedPapers: filtered },
    });
    return { subjectName, filename, size };
  }

  previewEokulXlsx(buffer: Buffer) {
    return previewEokulStyleSheet(buffer);
  }

  /** Tek sınav oturumu için veli/öğrenci sorgu satırı (public API). */
  private async buildPublicPlacementRow(
    schoolId: string,
    schoolName: string,
    student: Student,
    seat: ButterflySeatAssignment,
    plan: ButterflyExamPlan,
  ) {
    const room = await this.roomRepo.findOne({ where: { id: seat.roomId, schoolId } });
    const building = room
      ? await this.buildingRepo.findOne({ where: { id: room.buildingId, schoolId } })
      : null;
    const c = student.classId ? await this.classRepo.findOne({ where: { id: student.classId } }) : null;
    const classLabel = c?.name ?? '';
    return {
      planId: plan.id,
      schoolName,
      planTitle: plan.title,
      examStartsAt: plan.examStartsAt.toISOString(),
      examEndsAt: plan.examEndsAt ? plan.examEndsAt.toISOString() : null,
      studentName: student.name,
      studentNumber: student.studentNumber,
      classLabel,
      buildingName: building?.name ?? '',
      roomName: room?.name ?? '',
      seatLabel: String(seat.seatIndex + 1),
    };
  }

  /** En yakın gelecek sınav önce; yoksa en son geçmiş sınav önce. */
  private sortPublicPlacementsByRelevance<T extends { examStartsAt: string }>(rows: T[]): T[] {
    const now = Date.now();
    return [...rows].sort((a, b) => {
      const ta = new Date(a.examStartsAt).getTime();
      const tb = new Date(b.examStartsAt).getTime();
      const aUp = ta >= now;
      const bUp = tb >= now;
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      if (aUp && bUp) return ta - tb;
      return tb - ta;
    });
  }

  async publicLookup(institutionCode: string, studentNumber: string, planId?: string) {
    const code = institutionCode.trim();
    const num = studentNumber.trim();
    if (!code || !num) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'Kurum kodu ve öğrenci numarası gerekli.' });
    }
    const school = await this.schoolRepo
      .createQueryBuilder('s')
      .where('LOWER(TRIM(s.institution_code)) = LOWER(TRIM(:code))', { code })
      .getOne();
    if (!school) {
      throw new NotFoundException({ code: 'SCHOOL_NOT_FOUND', message: 'Kurum bulunamadı.' });
    }
    const student = await this.studentRepo.findOne({
      where: { schoolId: school.id, studentNumber: num },
    });
    if (!student) {
      throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Öğrenci bulunamadı.' });
    }

    const publishedPlans = await this.planRepo.find({
      where: { schoolId: school.id, status: 'published' },
    });
    if (!publishedPlans.length) {
      throw new NotFoundException({ code: 'NO_PLAN', message: 'Yayınlanmış sınav oturumu yok.' });
    }
    const publishedById = new Map(publishedPlans.map((p) => [p.id, p]));

    let allowedPlanIds: string[];
    if (planId?.trim()) {
      const p = publishedById.get(planId.trim());
      if (!p) {
        throw new NotFoundException({ code: 'NO_PLAN', message: 'Sınav bulunamadı veya yayında değil.' });
      }
      allowedPlanIds = [p.id];
    } else {
      allowedPlanIds = publishedPlans.map((p) => p.id);
    }

    const allSeats = await this.seatRepo.find({ where: { studentId: student.id } });
    const seatsInScope = allSeats.filter((s) => allowedPlanIds.includes(s.planId));

    if (!seatsInScope.length) {
      return {
        found: false as const,
        schoolName: school.name,
        studentName: student.name,
        message: planId?.trim()
          ? 'Bu sınav için henüz koltuk atanmadı.'
          : 'Yayınlanmış sınavlarda koltuk kaydı bulunamadı.',
      };
    }

    const rows = await Promise.all(
      seatsInScope.map((seat) => {
        const plan = publishedById.get(seat.planId)!;
        return this.buildPublicPlacementRow(school.id, school.name, student, seat, plan);
      }),
    );
    const sorted = this.sortPublicPlacementsByRelevance(rows);
    const primary = sorted[0];

    const base = {
      found: true as const,
      ...primary,
    };
    if (sorted.length <= 1) return base;
    return { ...base, placements: sorted };
  }

  assertSchoolAccess(role: string, schoolId: string | null, targetSchoolId: string) {
    if (role === 'superadmin' || role === 'moderator') return;
    if (!schoolId || schoolId !== targetSchoolId) {
      throw new ForbiddenException();
    }
  }

  async deletePlan(schoolId: string, planId: string) {
    const p = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!p) throw new NotFoundException();
    await this.seatRepo.delete({ planId });
    await this.proctorRepo.delete({ planId });
    await this.planRepo.remove(p);
    return { success: true };
  }

  async getPlanDetail(schoolId: string, planId: string) {
    const plan = await this.planRepo.findOne({ where: { id: planId, schoolId } });
    if (!plan) throw new NotFoundException();
    const [seats, rooms] = await Promise.all([
      this.seatRepo.find({ where: { planId } }),
      this.roomRepo.find({ where: { schoolId } }),
    ]);
    const placedStudentIds = [...new Set(seats.map((s) => s.studentId))];
    const rules = mergeButterflyRules(plan.rules as Record<string, unknown>);
    const participants = await this.getParticipantStudents(schoolId, rules);
    const unplacedCount = participants.filter((s) => !placedStudentIds.includes(s.id)).length;
    const classIds = [...new Set(participants.map((s) => s.classId).filter(Boolean) as string[])];
    const usedRoomIds = [...new Set(seats.map((s) => s.roomId))];
    const totalCapacity = rooms.filter((r) => usedRoomIds.includes(r.id)).reduce((s, r) => s + r.capacity, 0);
    return {
      plan: { id: plan.id, title: plan.title, status: plan.status, examStartsAt: plan.examStartsAt, examEndsAt: plan.examEndsAt },
      placedCount: placedStudentIds.length,
      unplacedCount,
      classCount: classIds.length,
      roomCount: usedRoomIds.length,
      totalCapacity,
    };
  }

  async buildExamSchedulePdf(
    schoolId: string,
    planIds: string[],
    opts: {
      type: 'genel' | 'sinif' | 'sube';
      grade?: number;
      classId?: string;
      cityLine?: string;
      academicYear?: string;
      duzenleyen?: { name: string; title: string };
      onaylayan?: { name: string; title: string };
    },
  ) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const plansRaw = await this.planRepo.find({ where: planIds.map((id) => ({ id, schoolId })) });
    if (!plansRaw.length) throw new NotFoundException();

    const plans = plansRaw.filter(
      (p) => mergeButterflyRules(p.rules as Record<string, unknown>).planType !== 'period',
    );
    if (!plans.length) {
      throw new BadRequestException({
        message:
          'Sınav takvimi cetveli yalnızca sınav oturumlarından oluşur. Dönem planı (takvim kabı) satır olarak eklenmez; yalnızca oturumları seçin veya önce oturum oluşturun.',
      });
    }

    // Tek seferde sınıf havuzunu çek (her satır için tekrar sorgu atmıyoruz)
    const allClasses = await this.classRepo.find({ where: { schoolId } });
    const classById = new Map(allClasses.map((c) => [c.id, c]));
    const gradeClassIdSet =
      opts.type === 'sinif' && opts.grade
        ? new Set(allClasses.filter((c) => c.grade === opts.grade).map((c) => c.id))
        : null;
    const subeClass = opts.type === 'sube' && opts.classId ? classById.get(opts.classId) ?? null : null;

    const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const rows: Array<{ sn: number; gun: string; tarih: string; saat: string; sinavDersi: string; aciklama?: string; subeler?: string }> = [];

    const sorted = [...plans].sort((a, b) => a.examStartsAt.getTime() - b.examStartsAt.getTime());

    for (const p of sorted) {
      const rules = mergeButterflyRules(p.rules as Record<string, unknown>);

      // Sınıf/şube filtresine göre bu plan rapora dahil mi?
      let scopedClassIds: string[] | undefined;
      if (opts.type === 'sinif' && gradeClassIdSet) {
        const participantIds = rules.participantClassIds ?? [...gradeClassIdSet];
        scopedClassIds = participantIds.filter((id) => gradeClassIdSet.has(id));
        if (scopedClassIds.length === 0) continue;
      } else if (opts.type === 'sube' && subeClass) {
        const inPlan = rules.participantClassIds?.includes(subeClass.id) ?? true;
        if (!inPlan) continue;
        scopedClassIds = [subeClass.id];
      }

      // "Sınav Dersi": sinif/sube modunda yalnızca filtrelenen sınıfların derslerini birleştir.
      const csa = rules.classSubjectAssignments;
      let subjects: string;
      if (csa?.length) {
        const filtered = scopedClassIds
          ? csa.filter((a) => scopedClassIds!.includes(a.classId))
          : csa;
        const subjectNames = [...new Set(filtered.map((a) => a.subjectName))].filter(Boolean);
        subjects = subjectNames.length ? subjectNames.join(', ') : rules.subjectLabel ?? p.title;
      } else {
        subjects = rules.subjectLabel ?? p.title;
      }

      // "Şubeler": sinif/sube modu için yalnızca filtrelenen sınıf adları
      let subeler: string | undefined;
      if (opts.type !== 'genel') {
        const ids = scopedClassIds ?? rules.participantClassIds ?? [];
        const names = ids
          .map((id) => classById.get(id)?.name?.trim())
          .filter((s): s is string => Boolean(s))
          .sort((a, b) => a.localeCompare(b, 'tr'));
        subeler = names.length ? names.join(', ') : undefined;
      }

      const note = typeof p.description === 'string' ? p.description.split('\n')[0]?.trim() : '';

      const d = p.examStartsAt;
      rows.push({
        sn: rows.length + 1,
        gun: DAYS[d.getDay()] ?? '',
        tarih: d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        saat: rules.lessonPeriodLabel ?? '',
        sinavDersi: subjects,
        aciklama: note || undefined,
        subeler,
      });
    }

    let subtitle = '';
    if (opts.type === 'sinif' && opts.grade) {
      subtitle = `${opts.grade}. Sınıflar Sınav Takvimi`;
    } else if (opts.type === 'sube' && subeClass) {
      subtitle = `${subeClass.name} Şube Sınav Takvimi`;
    } else {
      subtitle = 'Genel Sınav Takvimi';
    }

    // Period title: tüm seçili sınavlar tek bir dönem planına (parentPlanId) bağlıysa onun adını kullan;
    // değilse rapor başlığını planlardan değil alt başlıktan üret.
    const firstPlan = sorted[0];
    const rules0 = mergeButterflyRules(firstPlan.rules as Record<string, unknown>);
    const parentIds = new Set(
      sorted
        .map((p) => mergeButterflyRules(p.rules as Record<string, unknown>).parentPlanId)
        .filter((x): x is string => Boolean(x)),
    );
    let periodTitle = firstPlan.title;
    if (parentIds.size === 1) {
      const parentId = [...parentIds][0]!;
      const parent = await this.planRepo.findOne({ where: { id: parentId, schoolId } });
      if (parent?.title) periodTitle = parent.title;
    } else if (sorted.length > 1 && parentIds.size === 0) {
      periodTitle = 'Sınav Takvimi';
    }

    const footerLines = rules0.reportFooterLines?.length ? rules0.reportFooterLines : undefined;

    const raw0 = firstPlan.rules as Record<string, unknown>;
    const cityLine = opts.cityLine || (typeof raw0.cityLine === 'string' ? raw0.cityLine : undefined);
    const academicYear = opts.academicYear || (typeof raw0.academicYear === 'string' ? raw0.academicYear : undefined);
    const duzenleyen = opts.duzenleyen
      ?? (raw0.duzenleyenName ? { name: raw0.duzenleyenName as string, title: (raw0.duzenleyenTitle as string) ?? '' } : undefined);
    const onaylayan = opts.onaylayan
      ?? (raw0.onaylayanName ? { name: raw0.onaylayanName as string, title: (raw0.onaylayanTitle as string) ?? '' } : undefined);

    return this.pdf.buildExamSchedulePdf({
      periodTitle,
      subtitle,
      schoolName: school?.name ?? '',
      cityLine,
      academicYear,
      rows,
      footerLines,
      duzenleyen,
      onaylayan,
    });
  }

  async listClassesWithStudentCounts(schoolId: string) {
    const classes = await this.classRepo.find({
      where: { schoolId },
      order: { grade: 'ASC', section: 'ASC', name: 'ASC' },
    });
    const students = await this.studentRepo.find({
      where: { schoolId },
      select: ['id', 'classId'],
    });
    const countMap = new Map<string, number>();
    for (const s of students) {
      if (s.classId) countMap.set(s.classId, (countMap.get(s.classId) ?? 0) + 1);
    }
    return classes.map((c) => ({ ...c, studentCount: countMap.get(c.id) ?? 0 }));
  }

  async setClassDefaultButterflyBuilding(schoolId: string, classId: string, buildingId: string | null) {
    const cls = await this.classRepo.findOne({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException();
    if (buildingId) {
      const b = await this.buildingRepo.findOne({ where: { id: buildingId, schoolId } });
      if (!b) throw new BadRequestException({ message: 'Bina bulunamadı veya bu okula ait değil.' });
    }
    await this.classRepo.update({ id: classId, schoolId }, { butterflyDefaultBuildingId: buildingId });
    return { id: classId, butterflyDefaultBuildingId: buildingId };
  }

  async listAllStudents(schoolId: string) {
    const students = await this.studentRepo.find({
      where: { schoolId },
      order: { name: 'ASC' },
    });
    // classId -> className map
    const classIds = [...new Set(students.map((s) => s.classId).filter(Boolean) as string[])];
    const classes = classIds.length
      ? await this.classRepo.find({ where: { id: In(classIds), schoolId } })
      : [];
    const cMap = new Map(classes.map((c) => [c.id, c.name]));
    return students.map((s) => ({ ...s, className: s.classId ? (cMap.get(s.classId) ?? null) : null }));
  }

  async listStudentsForClass(schoolId: string, classId: string) {
    const cls = await this.classRepo.findOne({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException();
    return this.studentRepo.find({
      where: { schoolId, classId },
      order: { name: 'ASC' },
    });
  }

  async createStudent(schoolId: string, classId: string, dto: { name: string; studentNumber?: string }) {
    const cls = await this.classRepo.findOne({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException();
    const s = this.studentRepo.create({
      schoolId,
      classId,
      name: dto.name.trim(),
      studentNumber: dto.studentNumber?.trim() ?? null,
    });
    return this.studentRepo.save(s);
  }

  async deleteStudent(schoolId: string, studentId: string) {
    const s = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (!s) throw new NotFoundException();
    await this.studentRepo.remove(s);
    return { success: true };
  }

  async bulkImportStudentsFromText(schoolId: string, text: string) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Expected format: tab-separated columns, first row may be header
    // Try to detect: classCode | studentNo | studentName or similar
    const classes = await this.classRepo.find({ where: { schoolId } });
    const classByLabel = new Map<string, typeof classes[0]>();
    for (const c of classes) {
      const label = [c.grade != null ? `${c.grade}` : '', c.section || '', c.name].filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ');
      classByLabel.set(label, c);
    }

    const results: { className: string; classId: string | null; students: { name: string; studentNumber: string | null }[] }[] = [];
    let currentClass: { className: string; classId: string | null; students: { name: string; studentNumber: string | null }[] } | null = null;
    
    for (const line of lines) {
      const parts = line.split(/\t/);
      if (parts.length >= 3) {
        // Likely a student row: [idx, studentNo, name, ...]
        const studentNo = parts[1]?.trim();
        const name = parts[2]?.trim();
        if (studentNo && name && currentClass) {
          currentClass.students.push({ name, studentNumber: studentNo || null });
        } else if (parts.length >= 2) {
          // Maybe class header row
          const className = parts[0]?.trim();
          if (className && !studentNo?.match(/^\d+$/)) {
            // looks like a class label
            const key = className.toLowerCase().replace(/\s+/g, ' ');
            const cls = classByLabel.get(key) ?? null;
            currentClass = { className, classId: cls?.id ?? null, students: [] };
            results.push(currentClass);
          }
        }
      } else if (parts.length === 1 || (parts.length === 2 && !parts[0]?.match(/^\d+$/))) {
        // Single token line - class name
        const className = parts[0]?.trim();
        if (className) {
          const key = className.toLowerCase().replace(/\s+/g, ' ');
          const cls = classByLabel.get(key) ?? null;
          currentClass = { className, classId: cls?.id ?? null, students: [] };
          results.push(currentClass);
        }
      }
    }

    let created = 0;
    let skipped = 0;
    for (const group of results) {
      if (!group.classId) { skipped += group.students.length; continue; }
      for (const st of group.students) {
        if (!st.name) { skipped++; continue; }
        const existing = st.studentNumber
          ? await this.studentRepo.findOne({ where: { schoolId, studentNumber: st.studentNumber } })
          : null;
        if (existing) { skipped++; continue; }
        await this.studentRepo.save(this.studentRepo.create({ schoolId, classId: group.classId, name: st.name, studentNumber: st.studentNumber }));
        created++;
      }
    }
    return { created, skipped, classGroups: results.map((r) => ({ className: r.className, classId: r.classId, count: r.students.length })) };
  }

  async getSchoolOverviewStats(schoolId: string) {
    // «Sınav salonları» sanal binası, her şube için otomatik oluşan koltuk havuzudur.
    // Anasayfa kartlarında fiziksel salon ve koltuk sayısını yansıtmak için bu binadaki
    // salonları hariç tutuyoruz.
    const virtualBuildings = await this.buildingRepo.find({ where: { schoolId }, select: ['id', 'name'] });
    const virtualBuildingIds = new Set(
      virtualBuildings
        .filter((b) => (b.name ?? '').trim().toLocaleLowerCase('tr-TR') === 'sınav salonları')
        .map((b) => b.id),
    );

    const [classCount, studentCount, roomRows, planCount] = await Promise.all([
      this.classRepo.count({ where: { schoolId } }),
      this.studentRepo.count({ where: { schoolId, classId: Not(IsNull()) } }),
      this.roomRepo.find({ where: { schoolId }, select: ['id', 'capacity', 'buildingId'] }),
      this.planRepo.count({ where: { schoolId } }),
    ]);
    const physicalRooms = roomRows.filter((r) => !virtualBuildingIds.has(r.buildingId));
    const totalCapacity = physicalRooms.reduce((s, r) => s + r.capacity, 0);
    return {
      classCount,
      studentCount,
      roomCount: physicalRooms.length,
      totalCapacity,
      planCount,
    };
  }
}
