import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { SchoolStatus, SchoolType, UserRole } from '../types/enums';

/** `enabled_modules` ile uyumlu anahtarlar (web-admin `SCHOOL_MODULE_KEYS`) */
const SCHOOL_MODULE_KEYS = [
  'duty',
  'tv',
  'extra_lesson',
  'document',
  'outcome',
  'optical',
  'smart_board',
  'teacher_agenda',
  'bilsem',
  'school_profile',
  'school_reviews',
] as const;

export interface SuperadminStatsPayload {
  users_by_role: Record<string, number>;
  users_by_status: Record<string, number>;
  teachers_pending_approval: number;
  schools_by_status: Record<string, number>;
  /** Kota “yakın” eşiği (örn. 0.9 = %90); env: STATS_TEACHER_QUOTA_NEAR_RATIO */
  teacher_quota_near_ratio: number;
  schools_teacher_quota_full: number;
  schools_teacher_quota_near: /** >= ratio, dolu değil */ number;
  module_school_counts: { key: string; count: number }[];
  users_registration_chart: { month: string; count: number }[];
  schools_askida: { id: string; name: string }[];
  schools_teacher_full: { id: string; name: string; teacher_count: number; teacher_limit: number }[];
  recent_schools: { id: string; name: string; created_at: string }[];
  recent_users: {
    id: string;
    email: string;
    role: string;
    display_name: string | null;
    created_at: string;
  }[];
  /** Okul türü → adet */
  schools_by_type: Record<string, number>;
  /** Tür alanı hâlâ yalnızca genel "lise" olan kayıtlar (inceleme için) */
  schools_lise_unspecified_count: number;
}

export interface StatsResult {
  schools: number;
  users: number;
  announcements: number;
  chart: { month: string; count: number }[];
  superadmin?: SuperadminStatsPayload;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
  ) {}

  async getStats(role: UserRole, schoolId: string | null): Promise<StatsResult> {
    const isSuperadmin = role === UserRole.superadmin;

    const schoolsPromise = isSuperadmin
      ? this.schoolRepo.count()
      : Promise.resolve(schoolId ? 1 : 0);

    const usersQb = this.userRepo.createQueryBuilder('u');
    if (!isSuperadmin && schoolId) {
      usersQb.andWhere('u.school_id = :schoolId', { schoolId });
    }
    const usersPromise = usersQb.getCount();

    const announcementsQb = this.announcementRepo.createQueryBuilder('a');
    if (!isSuperadmin && schoolId) {
      announcementsQb.andWhere('a.school_id = :schoolId', { schoolId });
    }
    const announcementsPromise = announcementsQb.getCount();

    const [schools, users, announcements] = await Promise.all([
      schoolsPromise,
      usersPromise,
      announcementsPromise,
    ]);

    const chart = await this.getMonthlyChart(role, schoolId);

    if (!isSuperadmin) {
      return { schools, users, announcements, chart };
    }

    const superadmin = await this.getSuperadminPayload();
    return { schools, users, announcements, chart, superadmin };
  }

  private async getSuperadminPayload(): Promise<SuperadminStatsPayload> {
    const months = [
      'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
      'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
    ];
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const roleRows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('u.role')
      .getRawMany<{ role: string; cnt: string }>();

    const statusRows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('u.status')
      .getRawMany<{ status: string; cnt: string }>();

    const users_by_role: Record<string, number> = {};
    for (const r of roleRows) users_by_role[r.role] = parseInt(r.cnt, 10) || 0;
    const users_by_status: Record<string, number> = {};
    for (const r of statusRows) users_by_status[r.status] = parseInt(r.cnt, 10) || 0;

    const pendingRaw = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.teacher })
      .andWhere('u.teacher_school_membership = :ms', { ms: 'pending' })
      .getCount();

    const schoolStatusRows = await this.schoolRepo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('s.status')
      .getRawMany<{ status: string; cnt: string }>();
    const schools_by_status: Record<string, number> = {};
    for (const r of schoolStatusRows) schools_by_status[r.status] = parseInt(r.cnt, 10) || 0;

    const schoolTypeRows = await this.schoolRepo
      .createQueryBuilder('s')
      .select('s.type', 'type')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('s.type')
      .getRawMany<{ type: string; cnt: string }>();
    const schools_by_type: Record<string, number> = {};
    for (const r of schoolTypeRows) schools_by_type[r.type] = parseInt(r.cnt, 10) || 0;

    const schools_lise_unspecified_count = await this.schoolRepo.count({ where: { type: SchoolType.lise } });

    const quotaNearRatio = (() => {
      const raw = process.env.STATS_TEACHER_QUOTA_NEAR_RATIO;
      const n = raw != null && raw !== '' ? parseFloat(raw) : 0.9;
      if (!Number.isFinite(n)) return 0.9;
      return Math.min(0.999, Math.max(0.5, n));
    })();

    const teacherAgg = await this.userRepo
      .createQueryBuilder('u')
      .select('u.school_id', 'school_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('u.role = :r', { r: UserRole.teacher })
      .andWhere('u.school_id IS NOT NULL')
      .groupBy('u.school_id')
      .getRawMany<{ school_id: string; cnt: string }>();
    const teacherCountBySchool = new Map<string, number>();
    for (const row of teacherAgg) {
      teacherCountBySchool.set(row.school_id, parseInt(row.cnt, 10) || 0);
    }

    const allSchools = await this.schoolRepo.find({
      select: [
        'id',
        'name',
        'teacher_limit',
        'enabled_modules',
        'status',
        'updated_at',
        'created_at',
      ],
    });

    let fullCnt = 0;
    let nearCnt = 0;
    for (const s of allSchools) {
      const tl = s.teacher_limit ?? 0;
      const tc = teacherCountBySchool.get(s.id) ?? 0;
      if (tl > 0 && tc >= tl) fullCnt++;
      else if (tl > 0 && tc < tl && tc >= tl * quotaNearRatio) nearCnt++;
    }

    const module_school_counts: { key: string; count: number }[] = SCHOOL_MODULE_KEYS.map((key) => ({
      key,
      count: allSchools.filter((sch) => {
        const m = sch.enabled_modules;
        return m == null || m.length === 0 || m.includes(key);
      }).length,
    }));

    const usersList = await this.userRepo
      .createQueryBuilder('u')
      .select('u.created_at', 'created_at')
      .where('u.created_at >= :start', { start })
      .andWhere('u.created_at <= :end', { end })
      .getMany();

    const countByMonth = new Map<number, number>();
    for (let i = 0; i < 12; i++) countByMonth.set(i, 0);
    usersList.forEach((u) => {
      const m = new Date(u.created_at).getMonth();
      countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
    });
    const users_registration_chart = months.map((month, i) => ({
      month,
      count: countByMonth.get(i) ?? 0,
    }));

    const schools_askida = allSchools
      .filter((s) => s.status === SchoolStatus.askida)
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8)
      .map((s) => ({ id: s.id, name: s.name }));

    const schools_teacher_full = allSchools
      .map((s) => {
        const tl = s.teacher_limit ?? 0;
        const tc = teacherCountBySchool.get(s.id) ?? 0;
        return { s, tl, tc };
      })
      .filter((x) => x.tl > 0 && x.tc >= x.tl)
      .sort((a, b) => a.s.name.localeCompare(b.s.name, 'tr'))
      .slice(0, 8)
      .map((x) => ({
        id: x.s.id,
        name: x.s.name,
        teacher_count: x.tc,
        teacher_limit: x.tl,
      }));

    const recentSchoolRows = [...allSchools]
      .sort((a, b) => {
        const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
        const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return cb - ca;
      })
      .slice(0, 5);

    const recentUserRows = await this.userRepo.find({
      order: { created_at: 'DESC' },
      take: 5,
      select: ['id', 'email', 'role', 'display_name', 'created_at'],
    });

    const toIso = (d: Date | string) =>
      d instanceof Date ? d.toISOString() : new Date(d).toISOString();

    return {
      users_by_role,
      users_by_status,
      teachers_pending_approval: pendingRaw,
      schools_by_status,
      teacher_quota_near_ratio: quotaNearRatio,
      schools_teacher_quota_full: fullCnt,
      schools_teacher_quota_near: nearCnt,
      module_school_counts,
      users_registration_chart,
      schools_askida: schools_askida ?? [],
      schools_teacher_full: schools_teacher_full ?? [],
      recent_schools: recentSchoolRows.map((r) => ({
        id: r.id,
        name: r.name,
        created_at: toIso(r.created_at!),
      })),
      recent_users: recentUserRows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        display_name: r.display_name ?? null,
        created_at: toIso(r.created_at),
      })),
      schools_by_type,
      schools_lise_unspecified_count,
    };
  }

  private async getMonthlyChart(
    role: UserRole,
    schoolId: string | null,
  ): Promise<{ month: string; count: number }[]> {
    const months = [
      'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
      'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
    ];
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const qb = this.announcementRepo
      .createQueryBuilder('a')
      .select('a.created_at', 'created_at')
      .where('a.created_at >= :start', { start })
      .andWhere('a.created_at <= :end', { end });

    if (role !== UserRole.superadmin && schoolId) {
      qb.andWhere('a.school_id = :schoolId', { schoolId });
    }

    const list = await qb.getMany();
    const countByMonth = new Map<number, number>();
    for (let i = 0; i < 12; i++) countByMonth.set(i, 0);
    list.forEach((a) => {
      const m = new Date(a.created_at).getMonth();
      countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
    });

    return months.map((month, i) => ({
      month,
      count: countByMonth.get(i) ?? 0,
    }));
  }
}
