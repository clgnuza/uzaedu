import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TvDevice } from './entities/tv-device.entity';
import { UserRole } from '../types/enums';
import { randomBytes } from 'crypto';

@Injectable()
export class TvDevicesService {
  constructor(
    @InjectRepository(TvDevice)
    private readonly repo: Repository<TvDevice>,
  ) {}

  async list(schoolId: string | null, role: UserRole): Promise<TvDevice[]> {
    if (role !== UserRole.school_admin && role !== UserRole.superadmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (role === UserRole.school_admin && !schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const qb = this.repo
      .createQueryBuilder('t')
      .orderBy('t.display_group', 'ASC')
      .addOrderBy('t.name', 'ASC');
    if (role === UserRole.school_admin && schoolId) {
      qb.andWhere('t.school_id = :schoolId', { schoolId });
    }
    return qb.getMany();
  }

  async create(schoolId: string, role: UserRole, displayGroup: 'corridor' | 'teachers' = 'corridor'): Promise<TvDevice> {
    if (role !== UserRole.school_admin && role !== UserRole.superadmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    if (role === UserRole.school_admin && !schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const existing = await this.repo.count({
      where: { school_id: schoolId, display_group: displayGroup },
    });
    if (existing >= 1) {
      throw new BadRequestException({
        code: 'TV_DEVICE_GROUP_LIMIT',
        message:
          displayGroup === 'teachers'
            ? 'Öğretmenler odası ekranı için zaten bir cihaz tanımlı. Yenisini eklemek için önce mevcut cihazı silin.'
            : 'Koridor ekranı için zaten bir cihaz tanımlı. Yenisini eklemek için önce mevcut cihazı silin.',
      });
    }
    const pairingCode = randomBytes(4).toString('hex').toUpperCase();
    const defaultName = displayGroup === 'teachers' ? 'Öğretmenler Odası TV' : 'Koridor TV';
    const device = this.repo.create({
      school_id: schoolId,
      pairing_code: pairingCode,
      name: defaultName,
      display_group: displayGroup,
      status: 'offline',
    });
    return this.repo.save(device);
  }

  async update(
    id: string,
    dto: { name?: string; display_group?: string },
    scope: { schoolId: string | null; role: UserRole },
  ): Promise<TvDevice> {
    const device = await this.repo.findOne({ where: { id } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (scope.role === UserRole.school_admin && device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    if (dto.name !== undefined) device.name = dto.name;
    if (dto.display_group !== undefined) {
      const nextGroup = dto.display_group === 'teachers' ? 'teachers' : 'corridor';
      if (nextGroup !== device.display_group) {
        const otherInTarget = await this.repo
          .createQueryBuilder('t')
          .where('t.school_id = :sid', { sid: device.school_id })
          .andWhere('t.display_group = :dg', { dg: nextGroup })
          .andWhere('t.id != :id', { id })
          .getCount();
        if (otherInTarget >= 1) {
          throw new BadRequestException({
            code: 'TV_DEVICE_GROUP_LIMIT',
            message:
              nextGroup === 'teachers'
                ? 'Öğretmenler odası için zaten başka bir cihaz var.'
                : 'Koridor için zaten başka bir cihaz var.',
          });
        }
      }
      device.display_group = nextGroup;
    }
    return this.repo.save(device);
  }

  async remove(id: string, scope: { schoolId: string | null; role: UserRole }): Promise<void> {
    const device = await this.repo.findOne({ where: { id } });
    if (!device) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cihaz bulunamadı.' });
    if (scope.role === UserRole.school_admin && device.school_id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    await this.repo.remove(device);
  }

  /** Cihaz heartbeat; last_seen_at günceller, status=online yapar. Public endpoint. */
  async heartbeat(deviceId: string): Promise<{ ok: boolean }> {
    const device = await this.repo.findOne({ where: { id: deviceId } });
    if (!device) return { ok: false };
    device.last_seen_at = new Date();
    device.status = 'online';
    await this.repo.save(device);
    return { ok: true };
  }

  /** Pairing: pairing_code ile cihazı bulur, school_id + display_group döner. */
  async pairByCode(code: string): Promise<{ device_id: string; school_id: string; display_group: string } | null> {
    const device = await this.repo.findOne({
      where: { pairing_code: code.toUpperCase().trim() },
    });
    if (!device) return null;
    return {
      device_id: device.id,
      school_id: device.school_id,
      display_group: device.display_group,
    };
  }
}
