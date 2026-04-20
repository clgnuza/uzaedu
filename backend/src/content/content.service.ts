import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets, SelectQueryBuilder } from 'typeorm';
import { ContentChannel } from './entities/content-channel.entity';
import { ContentSource } from './entities/content-source.entity';
import { ContentItem } from './entities/content-item.entity';
import { ContentSyncService, SyncResult } from './content-sync.service';
import { ListContentItemsDto } from './dto/list-content-items.dto';
import { CreateContentItemDto } from './dto/create-content-item.dto';
import { CreateContentChannelDto } from './dto/create-content-channel.dto';
import { CreateContentSourceDto } from './dto/create-content-source.dto';
import { paginate } from '../common/dtos/pagination.dto';
import { AppConfigService } from '../app-config/app-config.service';
import type { ContentSyncScheduleConfig } from '../app-config/app-config.service';
import type { UpdateContentSyncScheduleDto } from './dto/update-content-sync-schedule.dto';

/** MEB linklerini https'e normalize et; mixed content engelini önler */
function normalizeContentUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (!u.startsWith('http')) return u;
  if (u.match(/^https?:\/\/([a-z0-9-]+\.)*meb\.gov\.tr/i) && u.startsWith('http://')) {
    return 'https://' + u.slice(7);
  }
  return u;
}

/** image_url için aynı normalize (API cevabında https dön) */
function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const normalized = normalizeContentUrl(url);
  return normalized || null;
}

const HABERLER_FALLBACK_CHANNEL_KEYS = ['haberler', 'meb_duyurulari', 'il_duyurulari'] as const;

/** Yarışmalar sekmesi: bu kanallara bağlı tüm kaynaklardan yarışma/olimpiyat içeriği (tekilleştirilmiş kaynak listesi) */
const YARISMALAR_SOURCE_POOL_KEYS = ['haberler', 'meb_duyurulari', 'il_duyurulari', 'egitim_duyurulari'] as const;

const YARISMALAR_TITLE_ILIKE = [
  '%yarışma%',
  '%yarışması%',
  '%Yarışma%',
  '%YARIŞMA%',
  '%yarismasi%',
  '%olimpiyat%',
  '%Olimpiyat%',
  '%Ölimpiyat%',
  '%ödüllü%',
  '%Ödüllü%',
] as const;

/** RSS’te çoğunlukla news; başlık ipuçlarıyla sınav/ölçme içeriği */
const EXAM_TITLE_ILIKE = [
  '%sınav%',
  '%Sınav%',
  '%SINAV%',
  '%kılavuz%',
  '%Kılavuz%',
  '%ÖSYM%',
  '%ösym%',
  '%YKS%',
  '%yks%',
  '%LGS%',
  '%lgs%',
  '%MSÜ%',
  '%msü%',
  '%sınava%',
  '%Sınava%',
  '%yerleştirme%',
  '%Yerleştirme%',
] as const;

const PROJECT_TITLE_ILIKE = [
  '%TÜBİTAK%',
  '%Tubitak%',
  '%tübitak%',
  '%eTwinning%',
  '%etwinning%',
  '%proje%',
  '%Proje%',
  '%proje çağrı%',
  '%araştırma projesi%',
  '%ARAŞTIRMA%PROJ%',
] as const;

const EVENT_TITLE_ILIKE = [
  '%etkinlik%',
  '%Etkinlik%',
  '%ETKİNLİK%',
  '%seminer%',
  '%Seminer%',
  '%konferans%',
  '%Konferans%',
  '%şenlik%',
  '%Şenlik%',
  '%çevrimiçi%',
  '%çevrimiçi etkinlik%',
  '%webinar%',
  '%Webinar%',
] as const;

const DOCUMENT_TITLE_ILIKE = [
  '%yönetmelik%',
  '%Yönetmelik%',
  '%genelge%',
  '%Genelge%',
  '%tebliğ%',
  '%Tebliğ%',
  '%şablon%',
  '%Şablon%',
  '%yönerge%',
  '%Yönerge%',
  '%talimatname%',
  '%Talimatname%',
] as const;

const ANNOUNCEMENT_TITLE_ILIKE = [
  '%duyuru%',
  '%Duyuru%',
  '%DUYURU%',
  '%ilan%',
  '%İlan%',
  '%ilanı%',
  '%İlanı%',
] as const;

/** DB türü eşleşmesi veya başlık ipuçları (paramPrefix ile çakışma yok). */
function applyDbTypeOrTitlePatterns(
  qb: SelectQueryBuilder<ContentItem>,
  dbType: string,
  patterns: readonly string[],
  paramPrefix: string,
  itemAlias = 'item',
): void {
  qb.andWhere(
    new Brackets((wqb) => {
      wqb.where(`${itemAlias}.contentType = :_${paramPrefix}ct`, {
        [`_${paramPrefix}ct`]: dbType,
      });
      patterns.forEach((pat, i) => {
        wqb.orWhere(`${itemAlias}.title ILIKE :_${paramPrefix}p${i}`, {
          [`_${paramPrefix}p${i}`]: pat,
        });
      });
    }),
  );
}

/** DB türü competition veya başlıkta yarışma/olimpiyat ipucu (RSS çoğu kaydı news bırakır). */
function applyCompetitionBroadFilter(
  qb: SelectQueryBuilder<ContentItem>,
  itemAlias = 'item',
): void {
  applyDbTypeOrTitlePatterns(qb, 'competition', YARISMALAR_TITLE_ILIKE, 'yc', itemAlias);
}

function applyYarismalarContentPredicate(
  qb: SelectQueryBuilder<ContentItem>,
  itemAlias = 'item',
): void {
  applyCompetitionBroadFilter(qb, itemAlias);
}

function applyContentTypeFilterForList(
  qb: SelectQueryBuilder<ContentItem>,
  contentType: string,
): void {
  switch (contentType) {
    case 'competition':
      applyCompetitionBroadFilter(qb);
      break;
    case 'exam':
      applyDbTypeOrTitlePatterns(qb, 'exam', EXAM_TITLE_ILIKE, 'ex');
      break;
    case 'project':
      applyDbTypeOrTitlePatterns(qb, 'project', PROJECT_TITLE_ILIKE, 'pr');
      break;
    case 'event':
      applyDbTypeOrTitlePatterns(qb, 'event', EVENT_TITLE_ILIKE, 'ev');
      break;
    case 'document':
      applyDbTypeOrTitlePatterns(qb, 'document', DOCUMENT_TITLE_ILIKE, 'doc');
      break;
    case 'announcement':
      applyDbTypeOrTitlePatterns(qb, 'announcement', ANNOUNCEMENT_TITLE_ILIKE, 'an');
      break;
    default:
      qb.andWhere('item.contentType = :contentType', { contentType });
  }
}

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentChannel)
    private readonly channelRepo: Repository<ContentChannel>,
    @InjectRepository(ContentSource)
    private readonly sourceRepo: Repository<ContentSource>,
    @InjectRepository(ContentItem)
    private readonly itemRepo: Repository<ContentItem>,
    private readonly syncService: ContentSyncService,
    private readonly appConfigService: AppConfigService,
  ) {}

  private async getSourceIdsForChannelKeys(channelKeys: readonly string[]) {
    if (!channelKeys.length) return [];
    const sources = await this.sourceRepo
      .createQueryBuilder('source')
      .innerJoin('source.channels', 'channel')
      .where('source.isActive = :active', { active: true })
      .andWhere('channel.key IN (:...channelKeys)', { channelKeys: [...channelKeys] })
      .select(['source.id'])
      .distinct(true)
      .getMany();
    return sources.map((source) => source.id);
  }

  /** Kamuya açık Haberler listesi ile aynı filtre (yalnızca aktif içerikler) */
  private async countItemsForChannelPublic(channelKey: string): Promise<number> {
    const qb = this.itemRepo
      .createQueryBuilder('item')
      .where('item.isActive = :active', { active: true });

    if (channelKey === 'haberler') {
      const ids = await this.getSourceIdsForChannelKeys(HABERLER_FALLBACK_CHANNEL_KEYS);
      if (!ids.length) return 0;
      qb.andWhere('item.sourceId IN (:...ids)', { ids });
    } else if (channelKey === 'yarismalar') {
      const yids = await this.getSourceIdsForChannelKeys(YARISMALAR_SOURCE_POOL_KEYS);
      if (!yids.length) return 0;
      qb.andWhere('item.sourceId IN (:...yids)', { yids });
      applyYarismalarContentPredicate(qb);
    } else {
      qb
        .innerJoin('channel_sources', 'cs', 'cs.source_id = item.sourceId')
        .innerJoin('content_channels', 'ch', 'ch.id = cs.channel_id AND ch.key = :channelKey', {
          channelKey,
        });
    }
    return qb.getCount();
  }

  async getSyncSchedule(): Promise<{
    schedule: ContentSyncScheduleConfig;
    status: Awaited<ReturnType<AppConfigService['getContentSyncStatus']>>;
  }> {
    const [schedule, status] = await Promise.all([
      this.appConfigService.getContentSyncSchedule(),
      this.appConfigService.getContentSyncStatus(),
    ]);
    return { schedule, status };
  }

  async updateSyncSchedule(dto: UpdateContentSyncScheduleDto): Promise<{
    schedule: ContentSyncScheduleConfig;
    status: Awaited<ReturnType<AppConfigService['getContentSyncStatus']>>;
  }> {
    const patch: Partial<ContentSyncScheduleConfig> = {};
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;
    if (dto.interval_minutes !== undefined) patch.interval_minutes = dto.interval_minutes;
    await this.appConfigService.updateContentSyncSchedule(patch);
    return this.getSyncSchedule();
  }

  /** Son kullanıcı: MEB birimleri (sources) - meb_duyurulari kanalına bağlı kaynaklar. Yayın sayfası sekmeleri için. */
  async getMebSources() {
    const channel = await this.channelRepo.findOne({
      where: { key: 'meb_duyurulari', isActive: true },
      relations: ['sources'],
    });
    if (!channel?.sources?.length) return [];
    const active = channel.sources.filter((s) => s.isActive).sort((a, b) => a.label.localeCompare(b.label));
    return active.map((s) => ({ id: s.id, key: s.key, label: s.label }));
  }

  /** Son kullanıcı: Aktif kanallar listesi (Defterdoldur tarzı sayı ile) */
  async getChannels() {
    const channels = await this.channelRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', label: 'ASC' },
      relations: ['sources'],
    });
    const result = await Promise.all(
      channels.map(async (ch) => {
        if (ch.key === 'yarismalar') {
          const yids = await this.getSourceIdsForChannelKeys(YARISMALAR_SOURCE_POOL_KEYS);
          let count = 0;
          if (yids.length > 0) {
            const yqb = this.itemRepo
              .createQueryBuilder('item')
              .where('item.isActive = :active', { active: true })
              .andWhere('item.sourceId IN (:...yids)', { yids });
            applyYarismalarContentPredicate(yqb);
            count = await yqb.getCount();
          }
          return {
            id: ch.id,
            key: ch.key,
            label: ch.label,
            sortOrder: ch.sortOrder,
            itemCount: count,
          };
        }
        const sourceIds =
          ch.key === 'haberler'
            ? await this.getSourceIdsForChannelKeys(HABERLER_FALLBACK_CHANNEL_KEYS)
            : (ch.sources ?? []).filter((source) => source.isActive).map((source) => source.id);
        const count = sourceIds.length
          ? await this.itemRepo.count({
              where: {
                sourceId: In(sourceIds),
                isActive: true,
              },
            })
          : 0;
        return {
          id: ch.id,
          key: ch.key,
          label: ch.label,
          sortOrder: ch.sortOrder,
          itemCount: count,
        };
      }),
    );
    return result;
  }

  /** Son kullanıcı: İçerik listesi (filtreli) */
  async listItems(dto: ListContentItemsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const channelSourceIds =
      dto.channel_key === 'haberler'
        ? await this.getSourceIdsForChannelKeys(HABERLER_FALLBACK_CHANNEL_KEYS)
        : [];

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.source', 'source')
      .where('item.isActive = :active', { active: true })
      .orderBy('item.publishedAt', 'DESC')
      .addOrderBy('item.createdAt', 'DESC');

    if (dto.channel_key) {
      if (dto.channel_key === 'haberler') {
        if (channelSourceIds.length) {
          qb.andWhere('item.sourceId IN (:...channelSourceIds)', { channelSourceIds });
        } else {
          qb.andWhere('1 = 0');
        }
      } else if (dto.channel_key === 'yarismalar') {
        const yids = await this.getSourceIdsForChannelKeys(YARISMALAR_SOURCE_POOL_KEYS);
        if (yids.length) {
          qb.andWhere('item.sourceId IN (:...yids)', { yids });
          // İçerik türü seçiliyken yalnızca DB türü + kaynak havuzu kullanılır; başlık/yarışma OR'u tür filtresini boğmasın.
          if (!dto.content_type?.trim()) {
            applyYarismalarContentPredicate(qb);
          }
        } else {
          qb.andWhere('1 = 0');
        }
      } else {
        qb.innerJoin('channel_sources', 'cs', 'cs.source_id = item.sourceId')
          .innerJoin('content_channels', 'ch', 'ch.id = cs.channel_id AND ch.key = :channelKey', {
            channelKey: dto.channel_key,
          });
      }
    }

    if (dto.content_type?.trim()) {
      applyContentTypeFilterForList(qb, dto.content_type.trim());
    }

    if (dto.source_key) {
      qb.andWhere('source.key = :sourceKey', { sourceKey: dto.source_key });
    }

    if (dto.city) {
      if (dto.channel_key === 'il_duyurulari') {
        qb.andWhere('item.cityFilter = :city', { city: dto.city });
      } else {
        qb.andWhere('(item.cityFilter IS NULL OR item.cityFilter = :city)', { city: dto.city });
      }
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const formatted = items.map((i) => ({
      id: i.id,
      title: i.title,
      summary: i.summary,
      source_url: normalizeContentUrl(i.sourceUrl),
      image_url: normalizeImageUrl(i.imageUrl),
      source_key: i.source?.key,
      source_label: i.source?.label,
      content_type: i.contentType,
      published_at: i.publishedAt?.toISOString?.() ?? null,
    }));

    return paginate(formatted, total, page, limit);
  }

  /** Son kullanıcı: Tek içerik detay */
  async getItemById(id: string) {
    const item = await this.itemRepo.findOne({
      where: { id, isActive: true },
      relations: ['source'],
    });
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    }
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      source_url: normalizeContentUrl(item.sourceUrl),
      image_url: normalizeImageUrl(item.imageUrl),
      source_key: item.source?.key,
      source_label: item.source?.label,
      content_type: item.contentType,
      published_at: item.publishedAt?.toISOString?.() ?? null,
    };
  }

  // --- Admin ---

  async adminListChannels() {
    const channels = await this.channelRepo.find({
      order: { sortOrder: 'ASC', label: 'ASC' },
      relations: ['sources'],
    });
    return Promise.all(
      channels.map(async (ch) => ({
        id: ch.id,
        key: ch.key,
        label: ch.label,
        sortOrder: ch.sortOrder,
        isActive: ch.isActive,
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
        sources: (ch.sources ?? []).map((s) => ({
          id: s.id,
          key: s.key,
          label: s.label,
        })),
        itemCount: await this.countItemsForChannelPublic(ch.key),
      })),
    );
  }

  async adminCreateChannel(dto: CreateContentChannelDto) {
    const channel = this.channelRepo.create({
      key: dto.key,
      label: dto.label,
      sortOrder: dto.sort_order ?? 0,
      isActive: dto.is_active ?? true,
    });
    const saved = await this.channelRepo.save(channel);
    if (dto.source_ids?.length) {
      await this.channelRepo
        .createQueryBuilder()
        .relation(ContentChannel, 'sources')
        .of(saved.id)
        .add(dto.source_ids);
    }
    return this.channelRepo.findOne({ where: { id: saved.id }, relations: ['sources'] });
  }

  async adminUpdateChannel(id: string, dto: Partial<CreateContentChannelDto>) {
    const channel = await this.channelRepo.findOne({ where: { id }, relations: ['sources'] });
    if (!channel) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kanal bulunamadı.' });
    if (dto.key != null) channel.key = dto.key;
    if (dto.label != null) channel.label = dto.label;
    if (dto.sort_order != null) channel.sortOrder = dto.sort_order;
    if (dto.is_active != null) channel.isActive = dto.is_active;
    if (dto.source_ids != null && dto.source_ids.length >= 0) {
      const sources = await this.sourceRepo.findBy({ id: In(dto.source_ids) });
      channel.sources = sources;
    }
    await this.channelRepo.save(channel);
    return this.channelRepo.findOne({ where: { id }, relations: ['sources'] });
  }

  async adminListSources() {
    const sources = await this.sourceRepo.find({ order: { label: 'ASC' } });
    const raw = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.sourceId', 'sourceId')
      .addSelect('COUNT(*)', 'cnt')
      .where('item.isActive = :a', { a: true })
      .groupBy('item.sourceId')
      .getRawMany<{ sourceId: string; cnt: string }>();
    const countMap = new Map(raw.map((r) => [r.sourceId, parseInt(r.cnt, 10)]));
    return sources.map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      baseUrl: s.baseUrl,
      rssUrl: s.rssUrl,
      rssItemLimit: s.rssItemLimit,
      scrapeConfig: s.scrapeConfig,
      syncIntervalMinutes: s.syncIntervalMinutes,
      lastSyncedAt: s.lastSyncedAt?.toISOString?.() ?? null,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      itemCount: countMap.get(s.id) ?? 0,
    }));
  }

  async adminCreateSource(dto: CreateContentSourceDto) {
    const source = this.sourceRepo.create({
      key: dto.key,
      label: dto.label,
      baseUrl: dto.base_url ?? null,
      rssUrl: dto.rss_url ?? null,
      scrapeConfig: dto.scrape_config ?? null,
      syncIntervalMinutes: dto.sync_interval_minutes ?? 120,
      isActive: dto.is_active ?? true,
    });
    return this.sourceRepo.save(source);
  }

  async adminUpdateSource(id: string, dto: Partial<CreateContentSourceDto>) {
    const source = await this.sourceRepo.findOne({ where: { id } });
    if (!source) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kaynak bulunamadı.' });
    if (dto.key != null) source.key = dto.key;
    if (dto.label != null) source.label = dto.label;
    if (dto.base_url != null) source.baseUrl = dto.base_url;
    if (dto.rss_url != null) source.rssUrl = dto.rss_url;
    if (dto.scrape_config != null) source.scrapeConfig = dto.scrape_config;
    if (dto.sync_interval_minutes != null) source.syncIntervalMinutes = dto.sync_interval_minutes;
    if (dto.is_active != null) source.isActive = dto.is_active;
    return this.sourceRepo.save(source);
  }

  async adminListItems(dto: ListContentItemsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.source', 'source')
      .orderBy('item.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('item.createdAt', 'DESC');

    if (dto.channel_key) {
      if (dto.channel_key === 'yarismalar') {
        const yids = await this.getSourceIdsForChannelKeys(YARISMALAR_SOURCE_POOL_KEYS);
        if (yids.length) {
          qb.andWhere('item.sourceId IN (:...yids)', { yids });
          if (!dto.content_type?.trim()) {
            applyYarismalarContentPredicate(qb);
          }
        } else {
          qb.andWhere('1 = 0');
        }
      } else {
        qb.innerJoin('channel_sources', 'cs', 'cs.source_id = item.sourceId')
          .innerJoin('content_channels', 'ch', 'ch.id = cs.channel_id AND ch.key = :channelKey', {
            channelKey: dto.channel_key,
          });
      }
    }
    if (dto.content_type?.trim()) {
      applyContentTypeFilterForList(qb, dto.content_type.trim());
    }
    if (dto.source_key) qb.andWhere('source.key = :sk', { sk: dto.source_key });
    if (dto.city) qb.andWhere('(item.cityFilter IS NULL OR item.cityFilter = :city)', { city: dto.city });

    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    return paginate(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        summary: i.summary,
        source_url: normalizeContentUrl(i.sourceUrl),
        image_url: normalizeImageUrl(i.imageUrl),
        source_key: i.source?.key,
        source_label: i.source?.label,
        content_type: i.contentType,
        published_at: i.publishedAt?.toISOString?.() ?? null,
        is_active: i.isActive,
        created_at: i.createdAt?.toISOString?.() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async adminCreateItem(dto: CreateContentItemDto) {
    const item = this.itemRepo.create({
      sourceId: dto.source_id,
      contentType: dto.content_type ?? 'announcement',
      title: dto.title,
      summary: dto.summary ?? null,
      sourceUrl: dto.source_url,
      publishedAt: dto.published_at ? new Date(dto.published_at) : new Date(),
      isActive: dto.is_active ?? true,
      cityFilter: dto.city_filter ?? null,
    });
    return this.itemRepo.save(item);
  }

  async adminUpdateItem(id: string, dto: Partial<CreateContentItemDto>) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İçerik bulunamadı.' });
    if (dto.title != null) item.title = dto.title;
    if (dto.summary != null) item.summary = dto.summary;
    if (dto.source_url != null) item.sourceUrl = dto.source_url;
    if (dto.content_type != null) item.contentType = dto.content_type;
    if (dto.published_at != null) item.publishedAt = new Date(dto.published_at);
    if (dto.is_active != null) item.isActive = dto.is_active;
    if (dto.city_filter != null) item.cityFilter = dto.city_filter;
    return this.itemRepo.save(item);
  }

  async adminSync(): Promise<SyncResult> {
    const result = await this.syncService.runSync();
    try {
      await this.appConfigService.recordContentSyncResult(result, 'manual');
    } catch {
      /* ignore */
    }
    return result;
  }

  /** Placeholder (logo, mansetresim) görsellerini temizle */
  async adminClearPlaceholderImages(): Promise<{ cleared: number }> {
    return this.syncService.clearPlaceholderImages();
  }
}
