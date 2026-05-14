import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { DtFile } from './entities/dt-file.entity';
import { DtItem } from './entities/dt-item.entity';
import { DtVendor } from './entities/dt-vendor.entity';
import { DtQuote } from './entities/dt-quote.entity';
import { DtQuoteItem } from './entities/dt-quote-item.entity';
import { DtBudgetAccount } from './entities/dt-budget-account.entity';
import { DtBudgetBlock } from './entities/dt-budget-block.entity';
import { DtAward } from './entities/dt-award.entity';
import { DtGeneratedDoc } from './entities/dt-generated-doc.entity';
import { School } from '../schools/entities/school.entity';
import { UploadService } from '../upload/upload.service';
import {
  AddDtItemDto,
  AutoAwardDto,
  BlockDtBudgetDto,
  ReleaseDtBudgetDto,
  CopyDtFileDto,
  CreateDtBudgetAccountDto,
  CreateDtFileDto,
  CreateDtQuoteDto,
  CreateDtVendorDto,
  DtRegistryReportDto,
  GenerateDtDocDto,
  ListDtBudgetAccountsDto,
  ListDtFilesDto,
  ListDtVendorsDto,
  PatchDtFileDto,
  PatchDtItemDto,
  UpsertDtAwardItemDto,
  UpsertDtQuoteItemDto,
  RecordDtPaymentDto,
  CreateDtMaterialCategoryDto,
  CreateDtMaterialLibraryItemDto,
  ListDtMaterialLibraryDto,
  CreateDtAcceptanceCommissionDto,
  AddDtCommissionMemberDto,
} from './dto/dt.dto';
import { AppConfigService } from '../app-config/app-config.service';
import { dtFileStatusTr, dtTeminTypeTr } from './dt-temin-labels';
import { DtPayment } from './entities/dt-payment.entity';
import { DtMaterialLibrary } from './entities/dt-material-library.entity';
import { DtMaterialCategory } from './entities/dt-material-category.entity';
import { DtAcceptanceCommission } from './entities/dt-acceptance-commission.entity';
import { DtAcceptanceCommissionMember } from './entities/dt-acceptance-commission-member.entity';

@Injectable()
export class DogrudanTeminService {
  constructor(
    @InjectRepository(DtFile) private readonly fileRepo: Repository<DtFile>,
    @InjectRepository(DtItem) private readonly itemRepo: Repository<DtItem>,
    @InjectRepository(DtVendor) private readonly vendorRepo: Repository<DtVendor>,
    @InjectRepository(DtQuote) private readonly quoteRepo: Repository<DtQuote>,
    @InjectRepository(DtQuoteItem) private readonly quoteItemRepo: Repository<DtQuoteItem>,
    @InjectRepository(DtBudgetAccount) private readonly budgetRepo: Repository<DtBudgetAccount>,
    @InjectRepository(DtBudgetBlock) private readonly blockRepo: Repository<DtBudgetBlock>,
    @InjectRepository(DtAward) private readonly awardRepo: Repository<DtAward>,
    @InjectRepository(DtGeneratedDoc) private readonly docRepo: Repository<DtGeneratedDoc>,
    @InjectRepository(DtPayment) private readonly paymentRepo: Repository<DtPayment>,
    @InjectRepository(DtMaterialLibrary) private readonly matLibRepo: Repository<DtMaterialLibrary>,
    @InjectRepository(DtMaterialCategory) private readonly matCatRepo: Repository<DtMaterialCategory>,
    @InjectRepository(DtAcceptanceCommission) private readonly commissionRepo: Repository<DtAcceptanceCommission>,
    @InjectRepository(DtAcceptanceCommissionMember) private readonly commMemberRepo: Repository<DtAcceptanceCommissionMember>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    private readonly uploadService: UploadService,
    private readonly appConfig: AppConfigService,
  ) {}

  async listFiles(schoolId: string, q: ListDtFilesDto) {
    const qb = this.fileRepo.createQueryBuilder('f');
    qb.where('f.schoolId = :sid', { sid: schoolId });
    if (q.year) qb.andWhere('f.year = :y', { y: q.year });
    if (q.status?.trim()) qb.andWhere('f.status = :st', { st: q.status.trim() });
    if (q.temin_type?.trim()) qb.andWhere('f.teminType = :tt', { tt: q.temin_type.trim() });
    if (q.file_no?.trim()) qb.andWhere('f.fileNo ILIKE :fn', { fn: `%${q.file_no.trim()}%` });

    const includeArchived =
      q.include_archived === '1' ||
      q.include_archived === 'true' ||
      q.include_archived === 'yes';
    if (!includeArchived) qb.andWhere('f.archivedAt IS NULL');

    if (q.search?.trim()) {
      const s = `%${q.search.trim()}%`;
      qb.andWhere('(f.subject ILIKE :s OR f.fileNo ILIKE :s)', { s });
    }
    qb.orderBy('f.createdAt', 'DESC').limit(200);
    const items = await qb.getMany();
    return { items };
  }

  async createFile(schoolId: string, userId: string, dto: CreateDtFileDto) {
    const row = this.fileRepo.create({
      schoolId,
      year: dto.year,
      fileNo: dto.file_no.trim(),
      subject: dto.subject.trim(),
      teminType: dto.temin_type,
      status: 'draft',
      budgetAccountId: dto.budget_account_id?.trim() || null,
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    return this.fileRepo.save(row);
  }

  async getFile(schoolId: string, id: string) {
    const row = await this.fileRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    return row;
  }

  async archiveFile(schoolId: string, userId: string, id: string) {
    const row = await this.fileRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    row.archivedAt = new Date();
    row.updatedByUserId = userId;
    return this.fileRepo.save(row);
  }

  async unarchiveFile(schoolId: string, userId: string, id: string) {
    const row = await this.fileRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    row.archivedAt = null;
    row.updatedByUserId = userId;
    return this.fileRepo.save(row);
  }

  async copyFile(schoolId: string, userId: string, id: string, dto: CopyDtFileDto) {
    const src = await this.fileRepo.findOne({ where: { id, schoolId } });
    if (!src) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId: src.id }, order: { createdAt: 'ASC' } });
    const year = dto.target_year ?? src.year;

    const base = (dto.file_no?.trim() || `${src.fileNo}-K`).slice(0, 32);
    let fileNo = base;
    for (let i = 0; i < 50; i++) {
      const exists = await this.fileRepo.findOne({ where: { schoolId, year, fileNo }, select: ['id'] });
      if (!exists) break;
      fileNo = `${base.slice(0, 28)}-${i + 2}`.slice(0, 32);
    }
    const existsFinal = await this.fileRepo.findOne({ where: { schoolId, year, fileNo }, select: ['id'] });
    if (existsFinal) throw new BadRequestException({ code: 'DT_COPY_FAILED', message: 'Kopya için dosya no üretilemedi.' });

    const next = await this.fileRepo.save({
      schoolId,
      year,
      fileNo,
      subject: src.subject,
      teminType: src.teminType,
      status: 'draft',
      awardMode: 'manual',
      budgetAccountId: src.budgetAccountId,
      approxTotal: null,
      decisionTotal: null,
      paymentTotal: null,
      createdByUserId: userId,
      updatedByUserId: userId,
      archivedAt: null,
    });

    if (items.length) {
      await this.itemRepo.save(
        items.map((it) => ({
          schoolId,
          dtFileId: next.id,
          name: it.name,
          spec: it.spec,
          qty: it.qty,
          unit: it.unit,
          vatRate: it.vatRate,
          estimatedUnitPrice: it.estimatedUnitPrice,
          estimatedTotal: null,
        })),
      );
      await this.recalcFileTotalsBestEffort(schoolId, next.id);
    }

    return next;
  }

  async addItem(schoolId: string, userId: string, dtFileId: string, dto: AddDtItemDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const item = this.itemRepo.create({
      schoolId,
      dtFileId,
      name: dto.name.trim(),
      spec: dto.spec?.trim() || null,
      qty: dto.qty != null ? String(dto.qty).trim().replace(',', '.') : '1',
      unit: dto.unit?.trim() || null,
      vatRate: typeof dto.vat_rate === 'number' ? dto.vat_rate : 20,
      estimatedUnitPrice:
        dto.estimated_unit_price != null && String(dto.estimated_unit_price).trim()
          ? String(dto.estimated_unit_price).trim().replace(',', '.')
          : null,
      estimatedTotal: null,
    });
    void userId;
    const saved = await this.itemRepo.save(item);
    await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return saved;
  }

  async listItems(schoolId: string, dtFileId: string) {
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    return { items };
  }

  async patchFile(schoolId: string, userId: string, id: string, dto: PatchDtFileDto) {
    const row = await this.fileRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    if (dto.subject !== undefined) row.subject = dto.subject.trim();
    if (dto.temin_type !== undefined) row.teminType = dto.temin_type;
    if (dto.status !== undefined) row.status = dto.status.trim();
    if (dto.budget_account_id !== undefined) row.budgetAccountId = dto.budget_account_id?.trim() || null;
    row.updatedByUserId = userId;
    return this.fileRepo.save(row);
  }

  async patchItem(schoolId: string, userId: string, id: string, dto: PatchDtItemDto) {
    const row = await this.itemRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_ITEM_NOT_FOUND' });
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.spec !== undefined) row.spec = dto.spec?.trim() || null;
    if (dto.qty !== undefined) row.qty = String(dto.qty).trim().replace(',', '.');
    if (dto.unit !== undefined) row.unit = dto.unit?.trim() || null;
    if (dto.vat_rate !== undefined) row.vatRate = dto.vat_rate;
    if (dto.estimated_unit_price !== undefined) {
      row.estimatedUnitPrice =
        dto.estimated_unit_price != null && String(dto.estimated_unit_price).trim()
          ? String(dto.estimated_unit_price).trim().replace(',', '.')
          : null;
    }
    void userId;
    const saved = await this.itemRepo.save(row);
    await this.recalcFileTotalsBestEffort(schoolId, row.dtFileId);
    return saved;
  }

  async listVendors(schoolId: string, q: ListDtVendorsDto) {
    const where: Record<string, unknown> = { schoolId };
    if (q.search?.trim()) where.title = ILike(`%${q.search.trim()}%`);
    const items = await this.vendorRepo.find({ where, order: { title: 'ASC' }, take: 500 });
    return { items };
  }

  async createVendor(schoolId: string, userId: string, dto: CreateDtVendorDto) {
    const row = this.vendorRepo.create({
      schoolId,
      title: dto.title.trim(),
      taxNo: dto.tax_no?.trim() || null,
      contactName: dto.contact_name?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      address: dto.address?.trim() || null,
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    return this.vendorRepo.save(row);
  }

  async createQuote(schoolId: string, userId: string, dtFileId: string, dto: CreateDtQuoteDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendor_id, schoolId }, select: ['id'] });
    if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
    const row = this.quoteRepo.create({
      schoolId,
      dtFileId,
      vendorId: vendor.id,
      status: 'requested',
      requestedAt: new Date(),
      receivedAt: null,
      note: null,
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    return this.quoteRepo.save(row);
  }

  async listQuotes(schoolId: string, dtFileId: string) {
    const items = await this.quoteRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    return { items };
  }

  async listQuoteItems(schoolId: string, quoteId: string) {
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId, schoolId }, select: ['id'] });
    if (!quote) throw new NotFoundException({ code: 'DT_QUOTE_NOT_FOUND' });
    const items = await this.quoteItemRepo.find({ where: { schoolId, quoteId }, order: { createdAt: 'ASC' } });
    return { items };
  }

  async upsertQuoteItem(schoolId: string, quoteId: string, dto: UpsertDtQuoteItemDto) {
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId, schoolId }, select: ['id', 'dtFileId'] });
    if (!quote) throw new NotFoundException({ code: 'DT_QUOTE_NOT_FOUND' });
    const item = await this.itemRepo.findOne({
      where: { id: dto.dt_item_id, schoolId, dtFileId: quote.dtFileId },
      select: ['id'],
    });
    if (!item) throw new NotFoundException({ code: 'DT_ITEM_NOT_FOUND' });

    const existing = await this.quoteItemRepo.findOne({
      where: { schoolId, quoteId: quote.id, dtItemId: item.id },
      select: ['id'],
    });
    const row = this.quoteItemRepo.create({
      ...(existing ? { id: existing.id } : {}),
      schoolId,
      quoteId: quote.id,
      dtItemId: item.id,
      unitPrice: String(dto.unit_price).trim().replace(',', '.'),
      total: null,
    });
    const saved = await this.quoteItemRepo.save(row);
    await this.recalcFileTotalsBestEffort(schoolId, quote.dtFileId);
    return saved;
  }

  async listBudgetAccounts(schoolId: string, q: ListDtBudgetAccountsDto) {
    const where: Record<string, unknown> = { schoolId };
    if (q.year) where.year = q.year;
    const items = await this.budgetRepo.find({ where, order: { year: 'DESC', label: 'ASC' }, take: 2000 });
    return { items };
  }

  async createBudgetAccount(schoolId: string, userId: string, dto: CreateDtBudgetAccountDto) {
    const row = this.budgetRepo.create({
      schoolId,
      year: dto.year,
      parentId: dto.parent_id?.trim() || null,
      code: dto.code?.trim() || null,
      label: dto.label.trim(),
      allocated:
        dto.allocated != null && String(dto.allocated).trim()
          ? String(dto.allocated).trim().replace(',', '.')
          : '0',
      blocked: '0',
      spent: '0',
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    return this.budgetRepo.save(row);
  }

  async blockBudget(schoolId: string, userId: string, dtFileId: string, dto: BlockDtBudgetDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const acc = await this.budgetRepo.findOne({
      where: { id: dto.budget_account_id, schoolId },
      select: ['id', 'blocked'],
    });
    if (!acc) throw new NotFoundException({ code: 'DT_BUDGET_NOT_FOUND' });
    const amount = String(dto.amount).trim().replace(',', '.');
    const block = await this.blockRepo.save(
      this.blockRepo.create({
        schoolId,
        dtFileId,
        budgetAccountId: acc.id,
        amount,
        status: 'blocked',
        blockedAt: new Date(),
        releasedAt: null,
        createdByUserId: userId,
        updatedByUserId: userId,
      }),
    );
    const nextBlocked = (Number(acc.blocked) || 0) + (Number(amount) || 0);
    acc.blocked = nextBlocked.toFixed(6);
    acc.updatedByUserId = userId;
    await this.budgetRepo.save(acc);
    return { ok: true, block_id: block.id };
  }

  async listBudgetBlocks(schoolId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const items = await this.blockRepo.find({ where: { schoolId, dtFileId }, order: { blockedAt: 'DESC' } as any, take: 200 });
    return { items };
  }

  async releaseBudget(schoolId: string, userId: string, dtFileId: string, dto: ReleaseDtBudgetDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });

    const blocks = dto.block_id?.trim()
      ? await this.blockRepo.find({ where: { id: dto.block_id.trim(), schoolId, dtFileId, status: 'blocked' } as any })
      : await this.blockRepo.find({ where: { schoolId, dtFileId, status: 'blocked' } as any, take: 500 });

    if (blocks.length === 0) return { ok: true, released: 0 };

    const byAcc = new Map<string, number>();
    for (const b of blocks) byAcc.set(b.budgetAccountId, (byAcc.get(b.budgetAccountId) ?? 0) + (Number(b.amount) || 0));

    for (const b of blocks) {
      b.status = 'released';
      b.releasedAt = new Date();
      b.updatedByUserId = userId;
    }
    await this.blockRepo.save(blocks as any);

    const accIds = [...byAcc.keys()];
    const accs = accIds.length ? await this.budgetRepo.find({ where: { id: (accIds as any), schoolId } as any }) : [];
    for (const acc of accs) {
      const dec = byAcc.get(acc.id) ?? 0;
      const next = (Number(acc.blocked) || 0) - dec;
      acc.blocked = Math.max(0, next).toFixed(6);
      acc.updatedByUserId = userId;
    }
    if (accs.length) await this.budgetRepo.save(accs);

    return { ok: true, released: blocks.length };
  }

  async getDtRules() {
    return this.appConfig.getDtRulesConfig();
  }

  async listPayments(schoolId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const items = await this.paymentRepo.find({
      where: { schoolId, dtFileId },
      order: { paidAt: 'DESC' },
      take: 200,
    });
    return { items };
  }

  async recordPayment(schoolId: string, userId: string, dtFileId: string, dto: RecordDtPaymentDto) {
    const rules = await this.appConfig.getDtRulesConfig();
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });

    const amt = Number(String(dto.amount).trim().replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) throw new BadRequestException({ code: 'DT_PAYMENT_AMOUNT' });

    if (rules.require_budget_account_on_file && !file.budgetAccountId?.trim()) {
      throw new BadRequestException({ code: 'DT_RULE_BUDGET_REQUIRED' });
    }
    if (rules.require_award_before_payment) {
      const c = await this.awardRepo.count({ where: { schoolId, dtFileId } });
      if (c === 0) throw new BadRequestException({ code: 'DT_RULE_AWARD_REQUIRED' });
    }
    if (rules.require_quote_on_payment && !dto.quote_id?.trim()) {
      throw new BadRequestException({ code: 'DT_RULE_QUOTE_REQUIRED' });
    }
    const note = dto.note?.trim() ?? '';
    if (rules.payment_note_min_length > 0 && note.length < rules.payment_note_min_length) {
      throw new BadRequestException({ code: 'DT_RULE_NOTE_TOO_SHORT' });
    }

    let quoteId: string | null = null;
    if (dto.quote_id?.trim()) {
      const q = await this.quoteRepo.findOne({
        where: { id: dto.quote_id.trim(), schoolId, dtFileId },
        select: ['id'],
      });
      if (!q) throw new NotFoundException({ code: 'DT_QUOTE_NOT_FOUND' });
      quoteId = q.id;
    }

    let paidAt = new Date();
    if (dto.paid_at?.trim()) {
      const d = new Date(dto.paid_at.trim());
      if (!Number.isNaN(d.getTime())) paidAt = d;
    }

    const row = this.paymentRepo.create({
      schoolId,
      dtFileId,
      quoteId,
      amount: amt.toFixed(6),
      paidAt,
      note: note || null,
      referenceNo: dto.reference_no?.trim() || null,
      createdByUserId: userId,
    });
    await this.paymentRepo.save(row);

    if (file.budgetAccountId) {
      const acc = await this.budgetRepo.findOne({
        where: { id: file.budgetAccountId, schoolId },
        select: ['id', 'spent'],
      });
      if (acc) {
        const nextSpent = (Number(acc.spent) || 0) + amt;
        acc.spent = nextSpent.toFixed(6);
        acc.updatedByUserId = userId;
        await this.budgetRepo.save(acc);
      }
    }

    await this.recalcPaymentTotal(schoolId, dtFileId);
    return row;
  }

  private async recalcPaymentTotal(schoolId: string, dtFileId: string): Promise<void> {
    const raw = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(CAST(p.amount AS DECIMAL)), 0)', 'sum')
      .where('p.schoolId = :sid AND p.dtFileId = :fid', { sid: schoolId, fid: dtFileId })
      .getRawOne<{ sum: string }>();
    const total = Number(raw?.sum ?? 0);
    await this.fileRepo.update(
      { id: dtFileId, schoolId },
      { paymentTotal: Number.isFinite(total) ? total.toFixed(6) : null } as any,
    );
  }

  async listMaterialCategories(schoolId: string) {
    const items = await this.matCatRepo.find({ where: { schoolId }, order: { name: 'ASC' } });
    return { items };
  }

  async createMaterialCategory(schoolId: string, dto: CreateDtMaterialCategoryDto) {
    const existing = await this.matCatRepo.findOne({
      where: { schoolId, name: dto.name.trim(), parentId: dto.parent_id?.trim() || undefined },
    });
    if (existing) throw new BadRequestException({ code: 'DT_CATEGORY_EXISTS' });

    const row = this.matCatRepo.create({
      schoolId,
      name: dto.name.trim(),
      parentId: dto.parent_id?.trim() || null,
    });
    return this.matCatRepo.save(row);
  }

  async listMaterialLibrary(schoolId: string, q: ListDtMaterialLibraryDto) {
    const qb = this.matLibRepo.createQueryBuilder('m');
    qb.where('m.schoolId = :sid', { sid: schoolId });
    if (q.category_id?.trim()) qb.andWhere('m.categoryId = :cid', { cid: q.category_id.trim() });
    if (q.search?.trim()) {
      const s = `%${q.search.trim()}%`;
      qb.andWhere('(m.code ILIKE :s OR m.name ILIKE :s OR m.description ILIKE :s)', { s });
    }
    const limit = Math.min(q.limit ?? 100, 500);
    const skip = q.skip ?? 0;
    const [items, count] = await qb
      .orderBy('m.code', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return { items, count, limit, skip };
  }

  async createMaterialLibraryItem(schoolId: string, userId: string, dto: CreateDtMaterialLibraryItemDto) {
    const existing = await this.matLibRepo.findOne({
      where: { schoolId, code: dto.code.trim() },
    });
    if (existing) throw new BadRequestException({ code: 'DT_MATERIAL_CODE_EXISTS' });

    if (dto.category_id?.trim()) {
      const cat = await this.matCatRepo.findOne({
        where: { schoolId, id: dto.category_id.trim() },
        select: ['id'],
      });
      if (!cat) throw new NotFoundException({ code: 'DT_CATEGORY_NOT_FOUND' });
    }

    const row = this.matLibRepo.create({
      schoolId,
      categoryId: dto.category_id?.trim() || null,
      code: dto.code.trim(),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      unit: dto.unit?.trim() || null,
      vatRate: dto.vat_rate ?? 20,
      createdByUserId: userId,
    });
    return this.matLibRepo.save(row);
  }

  async listAwards(schoolId: string, dtFileId: string) {
    const items = await this.awardRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    return { items };
  }

  async upsertAwardItem(schoolId: string, userId: string, dtFileId: string, dto: UpsertDtAwardItemDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const item = await this.itemRepo.findOne({ where: { id: dto.dt_item_id, schoolId, dtFileId }, select: ['id', 'qty', 'vatRate'] as any });
    if (!item) throw new NotFoundException({ code: 'DT_ITEM_NOT_FOUND' });
    const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendor_id, schoolId }, select: ['id'] });
    if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });

    const existing = await this.awardRepo.findOne({
      where: { schoolId, dtFileId, dtItemId: item.id },
      select: ['id'],
    });
    const unitPrice = String(dto.unit_price).trim().replace(',', '.');
    const total = (Number(item.qty) || 0) * (Number(unitPrice) || 0);
    const row = this.awardRepo.create({
      ...(existing ? { id: existing.id } : {}),
      schoolId,
      dtFileId,
      dtItemId: item.id,
      vendorId: vendor.id,
      unitPrice,
      total: Number.isFinite(total) ? total.toFixed(6) : null,
      createdByUserId: existing ? undefined : userId,
      updatedByUserId: userId,
    } as any);
    const saved = await this.awardRepo.save(row);
    await this.fileRepo.update({ id: dtFileId, schoolId }, { awardMode: 'manual' } as any);
    await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return saved;
  }

  async autoAward(schoolId: string, userId: string, dtFileId: string, dto: AutoAwardDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    if (items.length === 0) return { ok: true, items: 0 };

    const quotes = await this.quoteRepo.find({ where: { schoolId, dtFileId }, select: ['id', 'vendorId'] as any });
    const quoteIds = quotes.map((q) => q.id);
    const quoteItems = quoteIds.length
      ? await this.quoteItemRepo.find({ where: { schoolId, quoteId: (quoteIds as any) } as any })
      : [];

    const quoteById = new Map(quotes.map((q) => [q.id, q]));
    const prices = new Map<string, Map<string, number>>(); // vendorId -> itemId -> unitPrice
    for (const qi of quoteItems) {
      const q = quoteById.get(qi.quoteId);
      if (!q) continue;
      const v = q.vendorId;
      if (!prices.has(v)) prices.set(v, new Map());
      prices.get(v)!.set(qi.dtItemId, Number(qi.unitPrice));
    }

    const choosePerItemLowest = () => {
      const chosen: Array<{ dtItemId: string; vendorId: string; unitPrice: number }> = [];
      for (const it of items) {
        let best: { vendorId: string; unitPrice: number } | null = null;
        for (const [vendorId, mp] of prices.entries()) {
          const up = mp.get(it.id);
          if (up == null || !Number.isFinite(up)) continue;
          if (!best || up < best.unitPrice) best = { vendorId, unitPrice: up };
        }
        if (best) chosen.push({ dtItemId: it.id, vendorId: best.vendorId, unitPrice: best.unitPrice });
      }
      return chosen;
    };

    const chooseTotalLowestSingleVendor = () => {
      let bestVendor: { vendorId: string; total: number } | null = null;
      for (const [vendorId, mp] of prices.entries()) {
        let total = 0;
        let ok = true;
        for (const it of items) {
          const up = mp.get(it.id);
          if (up == null || !Number.isFinite(up)) {
            ok = false;
            break;
          }
          total += (Number(it.qty) || 0) * up;
        }
        if (!ok) continue;
        if (!bestVendor || total < bestVendor.total) bestVendor = { vendorId, total };
      }
      if (!bestVendor) return [];
      const mp = prices.get(bestVendor.vendorId)!;
      return items
        .map((it) => ({ dtItemId: it.id, vendorId: bestVendor.vendorId, unitPrice: mp.get(it.id) }))
        .filter((x): x is { dtItemId: string; vendorId: string; unitPrice: number } => typeof x.unitPrice === 'number');
    };

    const chosen =
      dto.mode === 'per_item_lowest'
        ? choosePerItemLowest()
        : dto.mode === 'total_lowest_single_vendor'
          ? chooseTotalLowestSingleVendor()
          : [];

    if (chosen.length === 0) {
      await this.fileRepo.update({ id: dtFileId, schoolId }, { awardMode: dto.mode } as any);
      return { ok: true, items: 0 };
    }

    const existing = await this.awardRepo.find({ where: { schoolId, dtFileId } });
    const existingByItem = new Map(existing.map((a) => [a.dtItemId, a]));

    for (const c of chosen) {
      const it = items.find((x) => x.id === c.dtItemId);
      if (!it) continue;
      const total = (Number(it.qty) || 0) * (Number(c.unitPrice) || 0);
      const prev = existingByItem.get(c.dtItemId);
      const row = this.awardRepo.create({
        ...(prev ? { id: prev.id } : {}),
        schoolId,
        dtFileId,
        dtItemId: c.dtItemId,
        vendorId: c.vendorId,
        unitPrice: Number(c.unitPrice).toFixed(6),
        total: Number.isFinite(total) ? total.toFixed(6) : null,
        createdByUserId: prev ? prev.createdByUserId : userId,
        updatedByUserId: userId,
      });
      await this.awardRepo.save(row);
    }

    await this.fileRepo.update({ id: dtFileId, schoolId }, { awardMode: dto.mode } as any);
    await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return { ok: true, items: chosen.length };
  }

  async listDocs(schoolId: string, dtFileId: string) {
    const items = await this.docRepo.find({
      where: { schoolId, dtFileId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return {
      items: items.map((x) => ({
        id: x.id,
        docType: x.docType,
        fileFormat: x.fileFormat,
        filename: x.filename,
        createdAt: x.createdAt,
      })),
    };
  }

  async getDocDownloadUrl(schoolId: string, id: string) {
    const row = await this.docRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_DOC_NOT_FOUND' });
    const downloadUrl = await this.uploadService.getSignedDownloadUrl(row.storageKey, 3600, row.filename);
    return { download_url: downloadUrl, filename: row.filename };
  }

  async generateDocForFile(schoolId: string, userId: string, dtFileId: string, dto: GenerateDtDocDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name', 'principalName'] });
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    const awards = await this.awardRepo.find({ where: { schoolId, dtFileId } });
    const vendors = await this.vendorRepo.find({ where: { schoolId } });
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const awardByItemId = new Map(awards.map((a) => [a.dtItemId, a]));

    const filenameBase = `DT-${file.year}-${file.fileNo}-${dto.doc_type}`.replace(/[^\w\u00C0-\u024F\s.-]/gi, '').replace(/\s+/g, '-');
    if (dto.doc_type === 'ihtiyac_listesi') {
      const buffer = await this.buildIhtiyacListesiDocx({ school, file, items });
      const key = `dogrudan_temin/generated/${uuidv4()}-ihtiyac-listesi.docx`;
      await this.uploadService.uploadBuffer(
        key,
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      const filename = `${filenameBase}.docx`;
      await this.docRepo.save(
        this.docRepo.create({
          schoolId,
          dtFileId,
          docType: 'ihtiyac_listesi',
          fileFormat: 'docx',
          storageKey: key,
          filename,
          createdByUserId: userId,
        }),
      );
      const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
      return { download_url: downloadUrl, filename };
    }

    if (dto.doc_type === 'teklif_isteme') {
      const vendorId = String(dto.vendor_id ?? '').trim();
      if (!vendorId) throw new BadRequestException({ code: 'DT_VENDOR_ID_REQUIRED' });
      const vendor = vendorById.get(vendorId);
      if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
      const buffer = await this.buildTeklifIstemeDocx({ school, file, items, vendor });
      const key = `dogrudan_temin/generated/${uuidv4()}-teklif-isteme.docx`;
      await this.uploadService.uploadBuffer(
        key,
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      const filename = `${filenameBase}-${vendor.title}`.replace(/[^\w\u00C0-\u024F\s.-]/gi, '').replace(/\s+/g, '-').slice(0, 120) + '.docx';
      await this.docRepo.save(
        this.docRepo.create({
          schoolId,
          dtFileId,
          docType: 'teklif_isteme',
          fileFormat: 'docx',
          storageKey: key,
          filename,
          createdByUserId: userId,
        }),
      );
      const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
      return { download_url: downloadUrl, filename };
    }

    if (dto.doc_type === 'sozlesme') {
      const vendorId = String(dto.vendor_id ?? '').trim();
      if (!vendorId) throw new BadRequestException({ code: 'DT_VENDOR_ID_REQUIRED' });
      const vendor = vendorById.get(vendorId);
      if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
      const awarded = items
        .map((it) => ({ it, a: awardByItemId.get(it.id) ?? null }))
        .filter((x) => x.a && x.a.vendorId === vendorId) as Array<{ it: DtItem; a: DtAward }>;
      if (awarded.length === 0) throw new BadRequestException({ code: 'DT_NO_AWARDS_FOR_VENDOR' });
      const buffer = await this.buildSozlesmeDocx({ school, file, vendor, awarded });
      const key = `dogrudan_temin/generated/${uuidv4()}-sozlesme.docx`;
      await this.uploadService.uploadBuffer(
        key,
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      const filename = `${filenameBase}-${vendor.title}`.replace(/[^\w\u00C0-\u024F\s.-]/gi, '').replace(/\s+/g, '-').slice(0, 120) + '.docx';
      await this.docRepo.save(
        this.docRepo.create({
          schoolId,
          dtFileId,
          docType: 'sozlesme',
          fileFormat: 'docx',
          storageKey: key,
          filename,
          createdByUserId: userId,
        }),
      );
      const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
      return { download_url: downloadUrl, filename };
    }

    // karar
    const buffer = await this.buildKararDocx({ school, file, items, awardByItemId, vendorById });
    const key = `dogrudan_temin/generated/${uuidv4()}-karar.docx`;
    await this.uploadService.uploadBuffer(key, buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const filename = `${filenameBase}.docx`;
    await this.docRepo.save(this.docRepo.create({ schoolId, dtFileId, docType: 'karar', fileFormat: 'docx', storageKey: key, filename, createdByUserId: userId }));
    const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
    return { download_url: downloadUrl, filename };
  }

  private registryIncludeArchived(q: DtRegistryReportDto): boolean {
    const v = q.include_archived;
    return v === '1' || v === 'true' || v === 'yes';
  }

  async registryReport(schoolId: string, q: DtRegistryReportDto) {
    const includeArchived = this.registryIncludeArchived(q);
    const summary = await this.registrySummaryByType(schoolId, q, includeArchived);
    const files = await this.registryLedgerFiles(schoolId, q, includeArchived);
    const payments = await this.registryLedgerPayments(schoolId, q, includeArchived);
    return {
      year: q.year,
      month: q.month ?? null,
      include_archived: includeArchived,
      /** @deprecated kullanın: summary */
      items: summary,
      summary,
      files,
      payments,
    };
  }

  private async registrySummaryByType(schoolId: string, q: DtRegistryReportDto, includeArchived: boolean) {
    const qb = this.fileRepo.createQueryBuilder('f');
    qb.where('f.schoolId = :sid', { sid: schoolId }).andWhere('f.year = :y', { y: q.year });
    if (q.month) {
      qb.andWhere('EXTRACT(MONTH FROM f.createdAt) = :m', { m: q.month });
    }
    if (!includeArchived) qb.andWhere('f.archivedAt IS NULL');
    qb.select('f.teminType', 'temin_type')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(COALESCE(f.approxTotal, 0)),0)', 'approx_total')
      .addSelect('COALESCE(SUM(COALESCE(f.decisionTotal, 0)),0)', 'decision_total')
      .addSelect('COALESCE(SUM(COALESCE(f.paymentTotal, 0)),0)', 'payment_total')
      .groupBy('f.teminType')
      .orderBy('f.teminType', 'ASC');
    const rows = await qb.getRawMany<{
      temin_type: string;
      count: string;
      approx_total: string;
      decision_total: string;
      payment_total: string;
    }>();
    return rows.map((r) => ({
      temin_type: r.temin_type,
      temin_label: dtTeminTypeTr(r.temin_type),
      count: Number(r.count) || 0,
      approx_total: Number(r.approx_total) || 0,
      decision_total: Number(r.decision_total) || 0,
      payment_total: Number(r.payment_total) || 0,
    }));
  }

  private async registryLedgerFiles(schoolId: string, q: DtRegistryReportDto, includeArchived: boolean) {
    const qb = this.fileRepo
      .createQueryBuilder('f')
      .innerJoin('schools', 'sch', 'sch.id = f.schoolId')
      .leftJoin('dt_budget_accounts', 'b', 'b.id = f.budgetAccountId AND b.schoolId = f.schoolId')
      .where('f.schoolId = :sid', { sid: schoolId })
      .andWhere('f.year = :y', { y: q.year });
    if (q.month) {
      qb.andWhere('EXTRACT(MONTH FROM f.createdAt) = :m', { m: q.month });
    }
    if (!includeArchived) qb.andWhere('f.archivedAt IS NULL');
    qb.orderBy('f.createdAt', 'DESC')
      .select('sch.name', 'school_name')
      .addSelect('f.year', 'year')
      .addSelect('f.fileNo', 'file_no')
      .addSelect('f.subject', 'subject')
      .addSelect('f.teminType', 'temin_code')
      .addSelect('f.status', 'status_code')
      .addSelect('f.approxTotal', 'approx_total')
      .addSelect('f.decisionTotal', 'decision_total')
      .addSelect('f.paymentTotal', 'payment_total')
      .addSelect('b.code', 'budget_code')
      .addSelect('b.label', 'budget_label')
      .addSelect('f.createdAt', 'created_at')
      .addSelect('f.archivedAt', 'archived_at');
    const rows = await qb.getRawMany<{
      school_name: string;
      year: string;
      file_no: string;
      subject: string;
      temin_code: string;
      status_code: string;
      approx_total: string | null;
      decision_total: string | null;
      payment_total: string | null;
      budget_code: string | null;
      budget_label: string | null;
      created_at: Date;
      archived_at: Date | null;
    }>();
    return rows.map((r) => ({
      school_name: r.school_name,
      year: Number(r.year) || q.year,
      file_no: r.file_no,
      subject: r.subject,
      temin_code: r.temin_code,
      temin_label: dtTeminTypeTr(r.temin_code),
      status_code: r.status_code,
      status_label: dtFileStatusTr(r.status_code),
      approx_total: Number(r.approx_total) || 0,
      decision_total: Number(r.decision_total) || 0,
      payment_total: Number(r.payment_total) || 0,
      budget_code: r.budget_code,
      budget_label: r.budget_label,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      archived_at: r.archived_at ? (r.archived_at instanceof Date ? r.archived_at.toISOString() : String(r.archived_at)) : null,
    }));
  }

  private async registryLedgerPayments(schoolId: string, q: DtRegistryReportDto, includeArchived: boolean) {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('dt_files', 'f', 'f.id = p.dt_file_id')
      .leftJoin('dt_quotes', 'qt', 'qt.id = p.quote_id')
      .leftJoin('dt_vendors', 'v', 'v.id = qt.vendor_id')
      .innerJoin('schools', 'sch', 'sch.id = f.schoolId')
      .where('p.schoolId = :sid', { sid: schoolId })
      .andWhere('f.year = :y', { y: q.year });
    if (q.month) {
      qb.andWhere('EXTRACT(MONTH FROM p.paidAt) = :m', { m: q.month });
    }
    if (!includeArchived) qb.andWhere('f.archivedAt IS NULL');
    qb.orderBy('p.paidAt', 'DESC')
      .select('sch.name', 'school_name')
      .addSelect('f.year', 'year')
      .addSelect('f.fileNo', 'file_no')
      .addSelect('f.subject', 'file_subject')
      .addSelect('p.paidAt', 'paid_at')
      .addSelect('p.amount', 'amount')
      .addSelect('p.referenceNo', 'reference_no')
      .addSelect('p.note', 'note')
      .addSelect('v.title', 'vendor_title');
    const rows = await qb.getRawMany<{
      school_name: string;
      year: string;
      file_no: string;
      file_subject: string;
      paid_at: Date;
      amount: string;
      reference_no: string | null;
      note: string | null;
      vendor_title: string | null;
    }>();
    return rows.map((r) => ({
      school_name: r.school_name,
      year: Number(r.year) || q.year,
      file_no: r.file_no,
      file_subject: r.file_subject,
      paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : String(r.paid_at),
      amount: Number(r.amount) || 0,
      reference_no: r.reference_no,
      note: r.note,
      vendor_title: r.vendor_title,
    }));
  }

  async registryReportXlsx(schoolId: string, q: DtRegistryReportDto) {
    const data = await this.registryReport(schoolId, q);
    const wb = XLSX.utils.book_new();

    const ozet = (data.summary as Array<Record<string, unknown>>).map((x) => ({
      Yıl: data.year,
      'Ay (filtre)': data.month ?? '',
      'Temin kodu': x.temin_type,
      'Temin açıklaması': x.temin_label,
      'Dosya adedi': x.count,
      'Yaklaşık toplam (TL)': x.approx_total,
      'Karar toplamı (TL)': x.decision_total,
      'Ödenen toplam (TL)': x.payment_total,
    }));
    const wsOzet = XLSX.utils.json_to_sheet(
      ozet.length ? ozet : [{ Yıl: data.year, 'Ay (filtre)': data.month ?? '', Not: 'Kayıt yok' }],
    );
    XLSX.utils.book_append_sheet(wb, wsOzet, 'Ozet');

    const dosyaSatirlari = (data.files as Array<Record<string, unknown>>).map((r) => ({
      'Okul': r.school_name,
      'Yıl': r.year,
      'Dosya no': r.file_no,
      'Konu': r.subject,
      'Temin kodu': r.temin_code,
      'Temin': r.temin_label,
      'Durum kodu': r.status_code,
      'Durum': r.status_label,
      'Yaklaşık (TL)': r.approx_total,
      'Karar (TL)': r.decision_total,
      'Ödenen (TL)': r.payment_total,
      'Ekonomik kod': r.budget_code ?? '',
      'Bütçe hesabı': r.budget_label ?? '',
      'Kayıt tarihi': r.created_at,
      'Arşiv': r.archived_at ? 'Evet' : 'Hayır',
    }));
    const wsDosya = XLSX.utils.json_to_sheet(
      dosyaSatirlari.length ? dosyaSatirlari : [{ Not: 'Bu dönemde dosya yok' }],
    );
    XLSX.utils.book_append_sheet(wb, wsDosya, 'Dosya_satirlari');

    const odemeSatirlari = (data.payments as Array<Record<string, unknown>>).map((r) => ({
      'Okul': r.school_name,
      'Yıl': r.year,
      'Dosya no': r.file_no,
      'Konu': r.file_subject,
      'Ödeme tarihi': r.paid_at,
      'Tutar (TL)': r.amount,
      'Referans no': r.reference_no ?? '',
      'Açıklama': r.note ?? '',
      'Firma (teklif)': r.vendor_title ?? '',
    }));
    const wsOdeme = XLSX.utils.json_to_sheet(
      odemeSatirlari.length ? odemeSatirlari : [{ Not: 'Bu dönemde ödeme yok' }],
    );
    XLSX.utils.book_append_sheet(wb, wsOdeme, 'Odeme_satirlari');

    const meta = [
      { Alan: 'Hazırlayan', Değer: 'Öğretmen Pro — Doğrudan temin modülü' },
      { Alan: 'Not', Değer: 'HMB Harcama Yönetim Sistemi (HYS) sütun eşlemesi kurumunuza özeldir; bu dosyayı mutemet kontrolüne sunun.' },
      { Alan: 'Yıl', Değer: data.year },
      { Alan: 'Ay filtresi', Değer: data.month ?? 'Tümü' },
      { Alan: 'Arşiv dahil', Değer: data.include_archived ? 'Evet' : 'Hayır' },
    ];
    const wsMeta = XLSX.utils.json_to_sheet(meta);
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Aciklama');

    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const filename = `DT-mutemet-${data.year}${data.month ? '-' + String(data.month).padStart(2, '0') : ''}.xlsx`;
    const key = `dogrudan_temin/generated/${uuidv4()}-kayit-formu.xlsx`;
    await this.uploadService.uploadBuffer(
      key,
      out,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
    return { download_url: downloadUrl, filename };
  }

  private async recalcFileTotalsBestEffort(schoolId: string, dtFileId: string): Promise<void> {
    try {
      const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, select: ['id', 'qty', 'estimatedUnitPrice'] as any });
      const approx = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.estimatedUnitPrice) || 0), 0);
      const awards = await this.awardRepo.find({ where: { schoolId, dtFileId }, select: ['total'] as any });
      const decision = awards.reduce((sum, a) => sum + (Number(a.total) || 0), 0);
      await this.fileRepo.update(
        { id: dtFileId, schoolId },
        {
          approxTotal: Number.isFinite(approx) ? approx.toFixed(6) : null,
          decisionTotal: Number.isFinite(decision) ? decision.toFixed(6) : null,
        } as any,
      );
    } catch {
      /* ignore */
    }
  }

  private async buildIhtiyacListesiDocx(input: { school: Pick<School, 'name' | 'principalName'> | null; file: DtFile; items: DtItem[] }): Promise<Buffer> {
    const { school, file, items } = input;
    const title = `${school?.name ?? ''}`.trim();
    const header = [
      new Paragraph({ children: [new TextRun({ text: title || 'Kurum', bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `Doğrudan Temin İhtiyaç Listesi`, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo} · ${file.subject}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];

    const th = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18 })] })], shading: { fill: 'E8ECF0' } as any });
    const td = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })] });
    const rows: TableRow[] = [
      new TableRow({ children: [th('No'), th('Kalem'), th('Miktar'), th('Birim'), th('KDV'), th('Tahmini BF')] }),
      ...items.map((it, idx) =>
        new TableRow({
          children: [
            td(String(idx + 1)),
            td(`${it.name}${it.spec ? `\n${it.spec}` : ''}`),
            td(String(it.qty ?? '')),
            td(String(it.unit ?? '')),
            td(`%${it.vatRate}`),
            td(String(it.estimatedUnitPrice ?? '')),
          ],
        }),
      ),
    ];
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      },
    });

    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...header, table] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildKararDocx(input: {
    school: Pick<School, 'name' | 'principalName'> | null;
    file: DtFile;
    items: DtItem[];
    awardByItemId: Map<string, DtAward>;
    vendorById: Map<string, DtVendor>;
  }): Promise<Buffer> {
    const { school, file, items, awardByItemId, vendorById } = input;
    const title = `${school?.name ?? ''}`.trim();
    const header = [
      new Paragraph({ children: [new TextRun({ text: title || 'Kurum', bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `Doğrudan Temin Karar`, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo} · ${file.subject}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];

    const th = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18 })] })], shading: { fill: 'E8ECF0' } as any });
    const td = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })] });
    const rows: TableRow[] = [
      new TableRow({ children: [th('No'), th('Kalem'), th('Miktar'), th('Firma'), th('BF'), th('Tutar')] }),
      ...items.map((it, idx) => {
        const a = awardByItemId.get(it.id) ?? null;
        const v = a ? vendorById.get(a.vendorId) ?? null : null;
        const total = a?.total ?? '';
        return new TableRow({
          children: [
            td(String(idx + 1)),
            td(`${it.name}${it.spec ? `\n${it.spec}` : ''}`),
            td(`${it.qty ?? ''} ${it.unit ?? ''}`.trim()),
            td(v?.title ?? ''),
            td(a?.unitPrice ?? ''),
            td(total),
          ],
        });
      }),
    ];
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      },
    });

    const footer = [
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({ children: [new TextRun({ text: `Onaylayan: ${school?.principalName ?? ''}`, size: 18 })], alignment: AlignmentType.LEFT }),
    ];

    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...header, table, ...footer] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildTeklifIstemeDocx(input: {
    school: Pick<School, 'name' | 'principalName'> | null;
    file: DtFile;
    items: DtItem[];
    vendor: DtVendor;
  }): Promise<Buffer> {
    const { school, file, items, vendor } = input;
    const header = [
      new Paragraph({ children: [new TextRun({ text: (school?.name ?? 'Kurum').trim(), bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Teklif İsteme Yazısı', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo} · ${file.subject}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `Firma: ${vendor.title}`, size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];
    const th = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18 })] })], shading: { fill: 'E8ECF0' } as any });
    const td = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })] });
    const rows: TableRow[] = [
      new TableRow({ children: [th('No'), th('Kalem'), th('Miktar'), th('Birim'), th('Birim fiyat')] }),
      ...items.map((it, idx) =>
        new TableRow({
          children: [
            td(String(idx + 1)),
            td(`${it.name}${it.spec ? `\n${it.spec}` : ''}`),
            td(String(it.qty ?? '')),
            td(String(it.unit ?? '')),
            td(''),
          ],
        }),
      ),
    ];
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      },
    });
    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...header, table] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildSozlesmeDocx(input: {
    school: Pick<School, 'name' | 'principalName'> | null;
    file: DtFile;
    vendor: DtVendor;
    awarded: Array<{ it: DtItem; a: DtAward }>;
  }): Promise<Buffer> {
    const { school, file, vendor, awarded } = input;
    const total = awarded.reduce((sum, x) => sum + (Number(x.a.total) || 0), 0);
    const header = [
      new Paragraph({ children: [new TextRun({ text: (school?.name ?? 'Kurum').trim(), bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'Sözleşme', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo} · ${file.subject}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `Yüklenici: ${vendor.title}`, size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: `Toplam: ${total.toFixed(2)}`, size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];
    const th = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18 })] })], shading: { fill: 'E8ECF0' } as any });
    const td = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })] });
    const rows: TableRow[] = [
      new TableRow({ children: [th('No'), th('Kalem'), th('Miktar'), th('BF'), th('Tutar')] }),
      ...awarded.map((x, idx) =>
        new TableRow({
          children: [
            td(String(idx + 1)),
            td(`${x.it.name}${x.it.spec ? `\n${x.it.spec}` : ''}`),
            td(`${x.it.qty ?? ''} ${x.it.unit ?? ''}`.trim()),
            td(String(x.a.unitPrice ?? '')),
            td(String(x.a.total ?? '')),
          ],
        }),
      ),
    ];
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      },
    });
    const footer = [
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({ children: [new TextRun({ text: `Onay: ${school?.principalName ?? ''}`, size: 18 })] }),
    ];
    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...header, table, ...footer] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  async getAcceptanceCommission(schoolId: string, dtFileId: string) {
    const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId } });
    if (!comm) return { commission: null, members: [] };
    const members = await this.commMemberRepo.find({ where: { commissionId: comm.id } });
    return { commission: comm, members };
  }

  async createAcceptanceCommission(schoolId: string, userId: string, dto: CreateDtAcceptanceCommissionDto) {
    const file = await this.fileRepo.findOne({ where: { id: dto.dt_file_id, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });

    const existing = await this.commissionRepo.findOne({ where: { schoolId, dtFileId: dto.dt_file_id } });
    if (existing) {
      if (dto.chairman_user_id !== undefined) existing.chairmanUserId = dto.chairman_user_id || null;
      await this.commissionRepo.save(existing);
      return existing;
    }

    const comm = this.commissionRepo.create({
      schoolId,
      dtFileId: dto.dt_file_id,
      chairmanUserId: dto.chairman_user_id || null,
      createdByUserId: userId,
    });
    const saved = await this.commissionRepo.save(comm);

    if (dto.members?.length) {
      const members = dto.members.map((m) =>
        this.commMemberRepo.create({
          commissionId: saved.id,
          userId: m.user_id,
          title: m.title || null,
        }),
      );
      await this.commMemberRepo.save(members);
    }

    return saved;
  }

  async addCommissionMember(schoolId: string, commissionId: string, dto: AddDtCommissionMemberDto) {
    const comm = await this.commissionRepo.findOne({
      where: { id: commissionId, schoolId },
      select: ['id'],
    });
    if (!comm) throw new NotFoundException({ code: 'DT_COMMISSION_NOT_FOUND' });

    const existing = await this.commMemberRepo.findOne({
      where: { commissionId, userId: dto.user_id },
    });
    if (existing) throw new BadRequestException({ code: 'DT_MEMBER_EXISTS' });

    const member = this.commMemberRepo.create({
      commissionId,
      userId: dto.user_id,
      title: dto.title || null,
    });
    return this.commMemberRepo.save(member);
  }

  async removeCommissionMember(schoolId: string, memberId: string) {
    const member = await this.commMemberRepo.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException({ code: 'DT_MEMBER_NOT_FOUND' });

    const comm = await this.commissionRepo.findOne({ where: { id: member.commissionId, schoolId }, select: ['id'] });
    if (!comm) throw new NotFoundException({ code: 'DT_COMMISSION_NOT_FOUND' });

    await this.commMemberRepo.remove(member);
    return { ok: true };
  }

  async generatePaymentOrderPdf(schoolId: string, dtFileId: string, paymentId: string, orderNo?: string, notes?: string) {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId, schoolId, dtFileId } });
    if (!payment) throw new NotFoundException({ code: 'DT_PAYMENT_NOT_FOUND' });

    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });

    const quote = payment.quoteId ? await this.quoteRepo.findOne({ where: { id: payment.quoteId } }) : null;
    const vendor = quote ? await this.vendorRepo.findOne({ where: { id: quote.vendorId } }) : null;
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });

    const header = [
      new Paragraph({ children: [new TextRun({ text: (school?.name ?? 'Kurum').trim(), bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'ÖDEME EMRİ BELGESİ', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({ children: [new TextRun({ text: `Belge No: ${orderNo ?? payment.referenceNo ?? paymentId.slice(0, 8)}`, size: 18 })] }),
      new Paragraph({ children: [new TextRun({ text: `Tarih: ${new Date(payment.createdAt).toLocaleDateString('tr-TR')}`, size: 18 })] }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];

    const th = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18 })] })], shading: { fill: 'E8ECF0' } as any });
    const td = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })] });

    const rows: TableRow[] = [
      new TableRow({ children: [th('Açıklama'), th('Değer')] }),
      new TableRow({ children: [td('İş Adı'), td(file.subject)] }),
      new TableRow({ children: [td('Yüklenici'), td(vendor?.title ?? '—')] }),
      new TableRow({ children: [td('Ödeme Tutarı'), td(`${payment.amount} TL`)] }),
      new TableRow({ children: [td('Ödeme Tarihi'), td(new Date(payment.paidAt).toLocaleDateString('tr-TR'))] }),
      new TableRow({ children: [td('Referans No'), td(payment.referenceNo ?? '—')] }),
      new TableRow({ children: [td('Not'), td(payment.note ?? '—')] }),
      ...(notes ? [new TableRow({ children: [td('Açıklama'), td(notes)] })] : []),
    ];

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      },
    });

    const footer = [
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({ children: [new TextRun({ text: `Onay: ${school?.principalName ?? ''}`, size: 18 })] }),
      new Paragraph({ children: [new TextRun({ text: `Tarih: ${new Date().toLocaleDateString('tr-TR')}`, size: 18 })] }),
    ];

    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...header, table, ...footer] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  async getDashboard(schoolId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();

    const files = await this.fileRepo.find({
      where: { schoolId, year: currentYear } as any,
    });
    const activeFiles = files.filter((f) => !f.archivedAt);

    const activeCount = activeFiles.length;
    const approxTotal = activeFiles.reduce((sum, f) => sum + (Number(f.approxTotal) || 0), 0);
    const decisionTotal = activeFiles.reduce((sum, f) => sum + (Number(f.decisionTotal) || 0), 0);
    const paymentTotal = activeFiles.reduce((sum, f) => sum + (Number(f.paymentTotal) || 0), 0);

    const pendingPayments = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.schoolId = :sid', { sid: schoolId })
      .orderBy('p.paidAt', 'DESC')
      .take(10)
      .getMany();

    const byType = new Map<string, { count: number; approx: number; decision: number; payment: number }>();
    activeFiles.forEach((f) => {
      const key = f.teminType || 'unknown';
      const stats = byType.get(key) || { count: 0, approx: 0, decision: 0, payment: 0 };
      stats.count += 1;
      stats.approx += Number(f.approxTotal) || 0;
      stats.decision += Number(f.decisionTotal) || 0;
      stats.payment += Number(f.paymentTotal) || 0;
      byType.set(key, stats);
    });

    const recentFiles = activeFiles.slice(0, 5);

    return {
      year: currentYear,
      summary: {
        active_files: activeCount,
        approx_total: Number.isFinite(approxTotal) ? approxTotal.toFixed(2) : '0',
        decision_total: Number.isFinite(decisionTotal) ? decisionTotal.toFixed(2) : '0',
        payment_total: Number.isFinite(paymentTotal) ? paymentTotal.toFixed(2) : '0',
        pending_payment: Number.isFinite(decisionTotal - paymentTotal) ? (decisionTotal - paymentTotal).toFixed(2) : '0',
      },
      by_type: Array.from(byType.entries()).map(([type, stats]) => ({
        temin_type: type,
        count: stats.count,
        approx_total: Number.isFinite(stats.approx) ? stats.approx.toFixed(2) : '0',
        decision_total: Number.isFinite(stats.decision) ? stats.decision.toFixed(2) : '0',
        payment_total: Number.isFinite(stats.payment) ? stats.payment.toFixed(2) : '0',
      })),
      recent_files: recentFiles.map((f) => ({
        id: f.id,
        year: f.year,
        file_no: f.fileNo,
        subject: f.subject,
        temin_type: f.teminType,
        status: f.status,
      })),
      recent_payments: pendingPayments.map((p) => ({
        id: p.id,
        dt_file_id: p.dtFileId,
        amount: p.amount,
        paid_at: p.paidAt,
      })),
    };
  }

  async getBudgetHierarchy(schoolId: string, year: number, parentId?: string | null) {
    const items = await this.budgetRepo.find({
      where: { schoolId, year, parentId: parentId || undefined } as any,
      order: { code: 'ASC' },
    });

    const withChildren = await Promise.all(
      items.map(async (item) => {
        const children = await this.budgetRepo.count({
          where: { schoolId, year, parentId: item.id },
        });
        return {
          id: item.id,
          code: item.code,
          label: item.label,
          allocated: item.allocated,
          blocked: item.blocked,
          spent: item.spent,
          has_children: children > 0,
        };
      }),
    );

    return { items: withChildren, year };
  }

  async getBudgetHierarchyChildren(schoolId: string, year: number, parentId: string) {
    return this.budgetRepo.find({
      where: { schoolId, year, parentId },
      order: { code: 'ASC' },
    });
  }
}

