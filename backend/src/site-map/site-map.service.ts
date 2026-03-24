import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteMapItem } from './entities/site-map-item.entity';
import { School } from '../schools/entities/school.entity';
import { CreateSiteMapItemDto } from './dto/create-site-map-item.dto';
import { UpdateSiteMapItemDto } from './dto/update-site-map-item.dto';
import { PatchSchoolOverridesDto } from './dto/school-overrides.dto';

export interface SiteMapNode {
  id: string;
  parentId: string | null;
  title: string;
  path: string | null;
  description: string | null;
  sortOrder: number;
  children: SiteMapNode[];
}

@Injectable()
export class SiteMapService {
  constructor(
    @InjectRepository(SiteMapItem)
    private readonly itemRepo: Repository<SiteMapItem>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  /** Teacher/school_admin: Okul scope'lu birleşik liste (standart - hidden + custom) */
  async getForViewer(schoolId: string | null): Promise<SiteMapNode[]> {
    const template = await this.itemRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', title: 'ASC' },
    });
    const overrides = schoolId ? await this.getSchoolOverrides(schoolId) : null;
    const hiddenIds = new Set(overrides?.hiddenIds ?? []);
    const customItems = overrides?.customItems ?? [];
    const filtered = template.filter((item) => !hiddenIds.has(item.id));
    const flatNodes: Array<{ id: string; parentId: string | null; title: string; path: string | null; description: string | null; sortOrder: number }> = [
      ...filtered.map((i) => ({
        id: i.id,
        parentId: i.parentId,
        title: i.title,
        path: i.path,
        description: i.description,
        sortOrder: i.sortOrder,
      })),
      ...customItems.map((c) => ({
        id: c.id,
        parentId: c.parentId ?? null,
        title: c.title,
        path: c.path ?? null,
        description: c.description ?? null,
        sortOrder: c.sortOrder,
      })),
    ];
    return this.buildTree(flatNodes);
  }

  /** Superadmin: Ham şablon listesi (flat, is_active dahil) */
  async getTemplateFlat(): Promise<SiteMapItem[]> {
    return this.itemRepo.find({
      order: { sortOrder: 'ASC', title: 'ASC' },
    });
  }

  /** Superadmin: Şablon ağaç yapısı */
  async getTemplateTree(): Promise<SiteMapNode[]> {
    const items = await this.itemRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', title: 'ASC' },
    });
    const flat = items.map((i) => ({
      id: i.id,
      parentId: i.parentId,
      title: i.title,
      path: i.path,
      description: i.description,
      sortOrder: i.sortOrder,
    }));
    return this.buildTree(flat);
  }

  /** Superadmin: Öğe ekle */
  async createItem(dto: CreateSiteMapItemDto): Promise<SiteMapItem> {
    const item = this.itemRepo.create({
      parentId: dto.parentId ?? null,
      title: dto.title,
      path: dto.path ?? null,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.itemRepo.save(item);
  }

  /** Superadmin: Öğe güncelle */
  async updateItem(id: string, dto: UpdateSiteMapItemDto): Promise<SiteMapItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğe bulunamadı.' });
    if (dto.parentId !== undefined) item.parentId = dto.parentId ?? null;
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.path !== undefined) item.path = dto.path ?? null;
    if (dto.description !== undefined) item.description = dto.description ?? null;
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) item.isActive = dto.isActive;
    return this.itemRepo.save(item);
  }

  /** Superadmin: Öğe sil (soft: is_active=false) */
  async deleteItem(id: string): Promise<void> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğe bulunamadı.' });
    item.isActive = false;
    await this.itemRepo.save(item);
  }

  /** School_admin: Kendi okulunun override'larını getir */
  async getSchoolOverrides(schoolId: string): Promise<{ hiddenIds: string[]; customItems: PatchSchoolOverridesDto['customItems'] }> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    const ov = school.site_map_overrides;
    return {
      hiddenIds: ov?.hiddenIds ?? [],
      customItems: ov?.customItems ?? [],
    };
  }

  /** School_admin: Override'ları güncelle */
  async patchSchoolOverrides(schoolId: string, dto: PatchSchoolOverridesDto): Promise<void> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    const current = school.site_map_overrides ?? { hiddenIds: [], customItems: [] };
    const updated = {
      hiddenIds: dto.hiddenIds ?? current.hiddenIds,
      customItems: dto.customItems ?? current.customItems,
    };
    school.site_map_overrides = updated;
    await this.schoolRepo.save(school);
  }

  private buildTree(
    flat: Array<{ id: string; parentId: string | null; title: string; path: string | null; description: string | null; sortOrder: number }>,
  ): SiteMapNode[] {
    const map = new Map<string, SiteMapNode>();
    const roots: SiteMapNode[] = [];
    for (const raw of flat) {
      const node: SiteMapNode = {
        id: raw.id,
        parentId: raw.parentId,
        title: raw.title,
        path: raw.path,
        description: raw.description,
        sortOrder: raw.sortOrder,
        children: [],
      };
      map.set(raw.id, node);
    }
    for (const node of map.values()) {
      if (!node.parentId) {
        roots.push(node);
      } else {
        const parent = map.get(node.parentId);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
    }
    const sortChildren = (nodes: SiteMapNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      nodes.forEach((n) => sortChildren(n.children));
    };
    sortChildren(roots);
    return roots;
  }
}
