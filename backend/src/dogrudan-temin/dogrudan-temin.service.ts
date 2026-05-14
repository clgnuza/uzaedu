import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
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
  PatchDtSchoolProcurementSettingsDto,
  PutDtDocumentRegistryDto,
  SyncDtCommissionDto,
} from './dto/dt.dto';
import { AppConfigService } from '../app-config/app-config.service';
import { dtFileStatusTr, dtTeminTypeTr } from './dt-temin-labels';
import { DtPayment } from './entities/dt-payment.entity';
import { DtMaterialLibrary } from './entities/dt-material-library.entity';
import { DtMaterialCategory } from './entities/dt-material-category.entity';
import { DtAcceptanceCommission } from './entities/dt-acceptance-commission.entity';
import { DtAcceptanceCommissionMember } from './entities/dt-acceptance-commission-member.entity';
import { DtSchoolProcurementSettings } from './entities/dt-school-procurement-settings.entity';
import { DtFileDocumentRegistry } from './entities/dt-file-document-registry.entity';
import { User } from '../users/entities/user.entity';
import { DT_COMMISSION_KINDS, DT_REGISTRY_STAGES } from './dt-workflow.constants';

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
    @InjectRepository(DtSchoolProcurementSettings) private readonly procurementSettingsRepo: Repository<DtSchoolProcurementSettings>,
    @InjectRepository(DtFileDocumentRegistry) private readonly registryRepo: Repository<DtFileDocumentRegistry>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
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
      procurementRef: dto.procurement_ref?.trim() || null,
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
      procurementRef: src.procurementRef?.trim() || null,
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
    if (dto.procurement_ref !== undefined) row.procurementRef = dto.procurement_ref?.trim() || null;
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
    const purpose = dto.purpose === 'market_research' ? 'market_research' : 'bid';
    const row = this.quoteRepo.create({
      schoolId,
      dtFileId,
      vendorId: vendor.id,
      purpose,
      status: 'requested',
      requestedAt: new Date(),
      receivedAt: null,
      note: null,
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    return this.quoteRepo.save(row);
  }

  async listQuotes(schoolId: string, dtFileId: string, purpose?: string) {
    const where: { schoolId: string; dtFileId: string; purpose?: string } = { schoolId, dtFileId };
    if (purpose === 'bid' || purpose === 'market_research') where.purpose = purpose;
    const items = await this.quoteRepo.find({ where, order: { createdAt: 'ASC' } });
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

  private async persistDtGeneratedDocx(input: {
    schoolId: string;
    userId: string;
    dtFileId: string;
    docType: string;
    buffer: Buffer;
    filenameBase: string;
    filenameExtra?: string;
    fileFormat?: 'docx' | 'pdf';
  }): Promise<{ download_url: string; filename: string }> {
    const { schoolId, userId, dtFileId, docType, buffer, filenameBase, filenameExtra } = input;
    const fileFormat = input.fileFormat ?? 'docx';
    const ext = fileFormat === 'pdf' ? 'pdf' : 'docx';
    const mime =
      fileFormat === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const key = `dogrudan_temin/generated/${uuidv4()}-${docType}.${ext}`;
    await this.uploadService.uploadBuffer(key, buffer, mime);
    const suffix = filenameExtra ? `-${filenameExtra}` : '';
    const filename =
      `${filenameBase}${suffix}`.replace(/[^\w\u00C0-\u024F\s.-]/gi, '').replace(/\s+/g, '-').slice(0, 180) + `.${ext}`;
    await this.docRepo.save(
      this.docRepo.create({
        schoolId,
        dtFileId,
        docType,
        fileFormat,
        storageKey: key,
        filename,
        createdByUserId: userId,
      }),
    );
    const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
    return { download_url: downloadUrl, filename };
  }

  private pdfRegisterFonts(doc: InstanceType<typeof PDFDocument>): { regular: string; bold: string } {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const reg = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bold = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
      doc.registerFont('DT', reg);
      doc.registerFont('DTB', bold);
      doc.font('DT');
      return { regular: 'DT', bold: 'DTB' };
    } catch {
      return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
    }
  }

  private pdfBuffer(
    build: (doc: InstanceType<typeof PDFDocument>, fonts: { regular: string; bold: string }) => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const fonts = this.pdfRegisterFonts(doc);
      let pageNo = 1;
      const drawFooter = () => {
        const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const y = doc.page.height - doc.page.margins.bottom + 10;
        doc.save();
        doc.font(fonts.regular).fontSize(8).fillColor('#6b7280').text(`Sayfa ${pageNo}`, doc.page.margins.left, y, {
          width: w,
          align: 'right',
        });
        doc.restore();
      };
      drawFooter();
      doc.on('pageAdded', () => {
        pageNo += 1;
        drawFooter();
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      build(doc, fonts);
      drawFooter();
      doc.end();
    });
  }

  private pdfHeader(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    lines: string[],
  ) {
    doc.font(fonts.bold).fontSize(14).text(lines[0] ?? 'Kurum', { align: 'center' });
    doc.moveDown(0.2);
    doc.font(fonts.regular).fontSize(10);
    for (const ln of lines.slice(1)) {
      if (!ln.trim()) continue;
      doc.text(ln.trim(), { align: 'center' });
    }
    doc.moveDown(0.6);
  }

  private pdfSimpleTable(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    headers: string[],
    rows: string[][],
  ) {
    const startX = doc.x;
    const startY = doc.y;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colW = pageW / Math.max(1, headers.length);
    const rowH = 18;
    const cell = (x: number, y: number, w: number, h: number, t: string, bold = false) => {
      doc.rect(x, y, w, h).stroke();
      doc
        .font(bold ? fonts.bold : fonts.regular)
        .fontSize(9)
        .text(t ?? '', x + 4, y + 4, { width: w - 8, height: h - 8 });
    };
    headers.forEach((h, i) => cell(startX + i * colW, startY, colW, rowH, h, true));
    let y = startY + rowH;
    for (const r of rows) {
      r.forEach((t, i) => cell(startX + i * colW, y, colW, rowH, String(t ?? '')));
      y += rowH;
      if (y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.y;
      }
    }
    doc.y = y + 6;
  }

  private pdfTable(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    columns: Array<{ header: string; width: number; align?: 'left' | 'center' | 'right' }>,
    rows: string[][],
    options?: { fontSize?: number; headerFontSize?: number; rowPaddingY?: number },
  ) {
    const startX = doc.x;
    let y = doc.y;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalW = columns.reduce((a, c) => a + c.width, 0) || 1;
    const widths = columns.map((c) => (c.width / totalW) * pageW);
    const fontSize = options?.fontSize ?? 8;
    const headerFontSize = options?.headerFontSize ?? 8;
    const padY = options?.rowPaddingY ?? 3;

    const rowHeightFor = (cells: string[], size: number) => {
      const hs = cells.map((t, i) => {
        const w = widths[i] - 8;
        const h = doc.heightOfString(String(t ?? ''), { width: w });
        return h;
      });
      return Math.max(16, Math.max(...hs) + padY * 2 + 2);
    };

    const drawRow = (cells: string[], bold = false, size = fontSize) => {
      const h = rowHeightFor(cells, size);
      if (y + h > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.y;
      }
      let x = startX;
      cells.forEach((t, i) => {
        const w = widths[i];
        doc.rect(x, y, w, h).stroke();
        doc
          .font(bold ? fonts.bold : fonts.regular)
          .fontSize(size)
          .text(String(t ?? ''), x + 4, y + padY, { width: w - 8, align: columns[i]?.align ?? 'left' });
        x += w;
      });
      y += h;
    };

    drawRow(columns.map((c) => c.header), true, headerFontSize);
    rows.forEach((r) => drawRow(r, false, fontSize));
    doc.y = y + 6;
  }

  private fmtTrDate(v: string | Date | null | undefined): string {
    if (!v) return '';
    try {
      const d = typeof v === 'string' ? new Date(v) : v;
      if (!Number.isFinite(d.getTime())) return '';
      return d.toLocaleDateString('tr-TR');
    } catch {
      return '';
    }
  }

  private async registryMapForFile(schoolId: string, dtFileId: string): Promise<Map<string, DtFileDocumentRegistry>> {
    const rows = await this.registryRepo.find({ where: { schoolId, dtFileId } });
    return new Map(rows.map((r) => [r.stage, r] as const));
  }

  private registrySayi(reg: DtFileDocumentRegistry | undefined): string {
    if (!reg) return '';
    const p = (reg.numberPrefix ?? '').trim();
    const s = (reg.numberSuffix ?? '').trim();
    if (!p && !s) return '';
    if (p && s) return `${p}/${s}`;
    return p || s;
  }

  private toNum(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  private fmtTry(v: unknown): string {
    const n = this.toNum(v);
    if (n == null) return '';
    return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}₺`;
  }

  private async pdfOfficialTop(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    input: {
      schoolId: string;
      school: Pick<School, 'name' | 'principalName'> | null;
      file: DtFile;
      stage: string;
      title: string;
      konu?: string;
      showProcurementRef?: boolean;
      registry: Map<string, DtFileDocumentRegistry>;
      settings: DtSchoolProcurementSettings | null;
    },
  ) {
    const { school, file, stage, title, registry, settings } = input;
    const reg = registry.get(stage);
    const sayi = this.registrySayi(reg);
    const tarih = this.fmtTrDate(reg?.docDate ?? null);
    const konu = (input.konu ?? file.subject).trim();
    const showProcRef = input.showProcurementRef !== false;
    this.pdfAntet(doc, fonts, school, settings);

    const leftX = doc.x;
    const rightX = doc.page.width - doc.page.margins.right;
    const y0 = doc.y;
    if (tarih) doc.font(fonts.regular).fontSize(10).text(tarih, rightX - 140, y0, { width: 140, align: 'right' });
    doc.font(fonts.regular).fontSize(10);
    if (sayi) doc.text(`Sayı : ${sayi}`, leftX, y0);
    doc.text(`Konu : ${konu}`, leftX, doc.y);
    if (showProcRef && file.procurementRef?.trim()) doc.text(`Doğrudan Temin Numarası : ${file.procurementRef.trim()}`, leftX, doc.y);
    doc.moveDown(0.6);

    if (title?.trim()) {
      doc.font(fonts.bold).fontSize(13).text(title.trim(), { align: 'center' });
      doc.moveDown(0.8);
    }
  }

  private pdfAntet(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    school: Pick<School, 'name' | 'principalName'> | null,
    settings: DtSchoolProcurementSettings | null,
  ) {
    const headerLines = [
      'T.C.',
      settings?.headerLine2?.trim() || '',
      settings?.headerLine3?.trim() || '',
      settings?.headerLine4?.trim() || (school?.name ?? '').trim(),
    ].filter((x) => x && x.trim());

    doc.font(fonts.bold).fontSize(10).text(headerLines[0] ?? 'T.C.', { align: 'center' });
    doc.font(fonts.bold).fontSize(12);
    for (const ln of headerLines.slice(1)) doc.text(ln, { align: 'center' });
    doc.moveDown(0.6);
  }

  private pdfSignRow(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    blocks: Array<{ name: string; title?: string; role?: string }>,
  ) {
    const left = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colW = w / Math.max(1, blocks.length);
    const y = doc.y;
    blocks.forEach((b, i) => {
      const x = left + i * colW;
      if (b.role) doc.font(fonts.regular).fontSize(9).text(b.role, x, y, { width: colW, align: 'center' });
      doc.font(fonts.bold).fontSize(10).text(b.name || '…………………', x, y + 14, { width: colW, align: 'center' });
      if (b.title) doc.font(fonts.regular).fontSize(9).text(b.title, x, y + 30, { width: colW, align: 'center' });
    });
    doc.y = y + 50;
  }

  private async commissionSignatureBlocks(input: {
    schoolId: string;
    dtFileId: string;
    kind: string;
  }): Promise<Array<{ name: string; title?: string; role?: string }>> {
    const { schoolId, dtFileId, kind } = input;
    const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId, kind } });
    if (!comm) return [];
    const members = await this.commMemberRepo.find({ where: { commissionId: comm.id }, order: { createdAt: 'ASC' } });
    const ids = [
      ...(comm.chairmanUserId ? [comm.chairmanUserId] : []),
      ...members.map((m) => m.userId),
    ];
    const names = await this.loadUserDisplayNames(ids);

    const out: Array<{ name: string; title?: string; role?: string }> = [];
    if (comm.chairmanUserId) {
      out.push({
        role: 'Başkan',
        name: names.get(comm.chairmanUserId) ?? comm.chairmanUserId,
        title: 'Komisyon Başkanı',
      });
    }
    for (const m of members) {
      out.push({
        role: (m.dutyLabel ?? m.title ?? 'Üye') as string,
        name: names.get(m.userId) ?? m.userId,
        title: undefined,
      });
    }
    return out;
  }

  private async buildDtLetterheadParagraphs(
    schoolId: string,
    school: Pick<School, 'name' | 'principalName'> | null,
    file: DtFile,
  ): Promise<Paragraph[]> {
    const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId } });
    const registryRows = await this.registryRepo.find({ where: { schoolId, dtFileId: file.id } });
    const byStage = new Map(registryRows.map((r) => [r.stage, r]));
    const pushC = (text: string, bold = false, size = 20) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold, size })],
      });
    const out: Paragraph[] = [];
    out.push(pushC((school?.name ?? 'Kurum').trim(), true, 24));
    if (settings?.headerLine2?.trim()) out.push(pushC(settings.headerLine2.trim(), false, 18));
    if (settings?.headerLine3?.trim()) out.push(pushC(settings.headerLine3.trim(), false, 18));
    if (settings?.headerLine4?.trim()) out.push(pushC(settings.headerLine4.trim(), false, 18));
    if (settings?.officialCorrespondenceCode?.trim()) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Yazı / muhatap kodu: ${settings.officialCorrespondenceCode.trim()}`, size: 18 })],
        }),
      );
    }
    if (file.procurementRef?.trim()) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `İhale kayıt no: ${file.procurementRef.trim()}`, size: 18 })],
        }),
      );
    }
    const regLines: string[] = [];
    for (const stage of DT_REGISTRY_STAGES) {
      const r = byStage.get(stage);
      if (!r) continue;
      if (!r.docDate && !(r.numberPrefix ?? '').trim() && !(r.numberSuffix ?? '').trim()) continue;
      const num = [r.numberPrefix?.trim(), r.numberSuffix?.trim()].filter(Boolean).join(' ') || '—';
      regLines.push(`${stage}: ${r.docDate ?? '—'} / ${num}`);
    }
    if (regLines.length) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Evrak defteri (girişler):', bold: true, size: 18 })],
        }),
      );
      for (const ln of regLines) out.push(pushC(ln, false, 16));
    }
    return out;
  }

  private async buildDtLetterheadLines(
    schoolId: string,
    school: Pick<School, 'name' | 'principalName'> | null,
    file: DtFile,
  ): Promise<string[]> {
    const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId } });
    const registryRows = await this.registryRepo.find({ where: { schoolId, dtFileId: file.id } });
    const byStage = new Map(registryRows.map((r) => [r.stage, r] as const));
    const out: string[] = [];
    out.push((school?.name ?? 'Kurum').trim());
    if (settings?.headerLine2?.trim()) out.push(settings.headerLine2.trim());
    if (settings?.headerLine3?.trim()) out.push(settings.headerLine3.trim());
    if (settings?.headerLine4?.trim()) out.push(settings.headerLine4.trim());
    if (settings?.officialCorrespondenceCode?.trim()) out.push(`Yazı / muhatap kodu: ${settings.officialCorrespondenceCode.trim()}`);
    if (file.procurementRef?.trim()) out.push(`Doğrudan temin no: ${file.procurementRef.trim()}`);
    const regLines: string[] = [];
    for (const stage of DT_REGISTRY_STAGES) {
      const r = byStage.get(stage);
      if (!r) continue;
      if (!r.docDate && !(r.numberPrefix ?? '').trim() && !(r.numberSuffix ?? '').trim()) continue;
      const num = [r.numberPrefix?.trim(), r.numberSuffix?.trim()].filter(Boolean).join(' ') || '—';
      regLines.push(`${stage}: ${r.docDate ?? '—'} / ${num}`);
    }
    if (regLines.length) out.push(...regLines);
    return out;
  }

  private async loadUserDisplayNames(ids: string[]): Promise<Map<string, string>> {
    const uniq = [...new Set(ids.filter(Boolean))];
    if (!uniq.length) return new Map();
    const users = await this.userRepo.find({
      where: { id: In(uniq) },
      select: ['id', 'display_name', 'email'] as any,
    });
    return new Map(
      users.map((u) => [u.id, ((u as any).display_name as string | null)?.trim() || (u as any).email || u.id]),
    );
  }

  async generateDocForFile(schoolId: string, userId: string, dtFileId: string, dto: GenerateDtDocDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name', 'principalName'] });
    const fileFormat = dto.file_format === 'pdf' ? 'pdf' : 'docx';
    const letterhead = await this.buildDtLetterheadParagraphs(schoolId, school, file);
    const letterheadLines = await this.buildDtLetterheadLines(schoolId, school, file);
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    const awards = await this.awardRepo.find({ where: { schoolId, dtFileId } });
    const vendors = await this.vendorRepo.find({ where: { schoolId } });
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const awardByItemId = new Map(awards.map((a) => [a.dtItemId, a]));

    const filenameBase = `DT-${file.year}-${file.fileNo}-${dto.doc_type}`.replace(/[^\w\u00C0-\u024F\s.-]/gi, '').replace(/\s+/g, '-');

    if (fileFormat === 'pdf') {
      const registry = await this.registryMapForFile(schoolId, file.id);
      const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId } });

      if (dto.doc_type === 'ihtiyac_listesi') {
        const buffer = await this.pdfBuffer((doc, fonts) => {
          void letterheadLines;
          void letterhead;
          void file;
          void school;
          void settings;
          void registry;
          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'ihtiyac_listesi',
            title: 'MAL/MALZEME İHTİYAÇ LİSTESİ',
            konu: file.subject,
            showProcurementRef: false,
            registry,
            settings,
          });
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'Sıra No', width: 45, align: 'center' },
              { header: 'Mal/Malzemenin Adı', width: 180 },
              { header: 'Özelliği', width: 210 },
              { header: 'Miktarı', width: 70, align: 'right' },
              { header: 'Ölçeği', width: 70, align: 'center' },
            ],
            items.map((it, idx) => [
              String(idx + 1),
              it.name ?? '',
              it.spec ?? '',
              String(it.qty ?? ''),
              String(it.unit ?? ''),
            ]),
            { fontSize: 8, headerFontSize: 8 },
          );
          doc.moveDown(0.6);
          doc.font(fonts.regular).fontSize(10).text(
            `Müdürlüğümüzün ihtiyacı olan mal/malzeme yukarıya çıkarılmış olup 4734 Sayılı İhale Yasası'nın 22/d maddesi gereğince Doğrudan Temin yoluyla satın alınması için uygun görüldüğü takdirde OLUR'larınıza arz ederim.`,
            { align: 'justify' },
          );
          doc.moveDown(0.8);
          doc.font(fonts.bold).fontSize(10).text(`${((school?.name ?? '').trim() || 'Kurum').toUpperCase()} MÜDÜRLÜĞÜNE`);
          doc.moveDown(0.2);
          this.pdfSignRow(doc, fonts, [
            {
              role: '(İhale/Harcama Yetkilisi)',
              name: settings?.realizationAuthorityName ?? '…………………',
              title: settings?.realizationAuthorityTitle ?? undefined,
            },
          ]);
          doc.moveDown(0.2);
          doc.font(fonts.bold).fontSize(10).text('OLUR', { align: 'center' });
          const d = this.fmtTrDate(registry.get('ihtiyac_listesi')?.docDate ?? null) || this.fmtTrDate(new Date());
          if (d) doc.font(fonts.regular).fontSize(10).text(d, { align: 'center' });
          this.pdfSignRow(doc, fonts, [
            {
              role: 'İhale(Harcama Yetkilisi)',
              name: settings?.spendingAuthorityName ?? (school?.principalName ?? '…………………'),
              title: settings?.spendingAuthorityTitle ?? undefined,
            },
          ]);
        });
        return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'ihtiyac_listesi', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'fiyat_arastirmasi') {
        const vendorId = String(dto.vendor_id ?? '').trim();
        if (!vendorId) throw new BadRequestException({ code: 'DT_VENDOR_ID_REQUIRED' });
        const vendor = vendorById.get(vendorId);
        if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
        const signs = await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: 'yaklasik_maliyet' });
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'fiyat_arastirma',
            title: '',
            konu: 'Fiyat Araştırması',
            showProcurementRef: false,
            registry,
            settings,
          });
          doc.font(fonts.bold).fontSize(10).text('İLGİLİ KİŞİ/FİRMA');
          doc.font(fonts.regular).fontSize(10).text(vendor.title);
          if (vendor.address?.trim()) doc.font(fonts.regular).fontSize(9).text(vendor.address.trim());
          doc.moveDown(0.5);
          doc.font(fonts.regular).fontSize(10).text(
            `${file.subject} işine ait aşağıda cinsi, özellikleri ve miktarları yazılı mallar/hizmetler 4734 sayılı Kamu İhale Kanunu'nun 22/d Maddesi gereğince Doğrudan Temin Usulüyle satın alınacağından yaklaşık maliyetin tespiti için piyasa araştırması yapılmaktadır; birim fiyatının ve tutarının KDV hariç bildirmenizi rica ederim/ederiz.`,
            { align: 'justify' },
          );
          doc.moveDown(0.6);
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'Sıra No', width: 40, align: 'center' },
              { header: 'Malzemenin Adı', width: 160 },
              { header: 'Özelliği', width: 180 },
              { header: 'Miktarı', width: 60, align: 'right' },
              { header: 'Ölçeği', width: 55, align: 'center' },
              { header: 'Birim Fiyatı', width: 70, align: 'right' },
              { header: 'Tutarı (KDV Hariç)', width: 85, align: 'right' },
            ],
            items.map((it, idx) => [
              String(idx + 1),
              it.name ?? '',
              it.spec ?? '',
              String(it.qty ?? ''),
              String(it.unit ?? ''),
              '',
              '',
            ]),
            { fontSize: 7.5, headerFontSize: 7.5 },
          );
          doc.moveDown(0.8);
          const blocks = signs.length
            ? signs.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
            : [
                { role: 'Komisyon Üyesi', name: '…………………' },
                { role: 'Komisyon Üyesi', name: '…………………' },
                { role: 'Komisyon Üyesi', name: '…………………' },
              ];
          for (let i = 0; i < blocks.length; i += 3) {
            this.pdfSignRow(doc, fonts, blocks.slice(i, i + 3));
            doc.moveDown(0.2);
          }
        });
        return this.persistDtGeneratedDocx({
          schoolId,
          userId,
          dtFileId,
          docType: 'fiyat_arastirmasi',
          buffer,
          filenameBase,
          filenameExtra: vendor.title,
          fileFormat: 'pdf',
        });
      }

      if (dto.doc_type === 'teklif_isteme') {
        const vendorId = String(dto.vendor_id ?? '').trim();
        if (!vendorId) throw new BadRequestException({ code: 'DT_VENDOR_ID_REQUIRED' });
        const vendor = vendorById.get(vendorId);
        if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'teklif_mektubu',
            title: 'TEKLİF MEKTUBU',
            konu: file.subject,
            showProcurementRef: true,
            registry,
            settings,
          });
          doc.font(fonts.regular).fontSize(10).text(
            `İdaremiz tarafından ${file.subject} işine ait aşağıda cinsi, özellikleri ve miktarları yazılı mallar/hizmetler 4734 sayılı Kamu İhale Kanunu'nun 22/d Maddesi gereğince Doğrudan Temin Usulüyle satın alınacaktır. İlgilenmeniz halinde; teklifin KDV hariç olarak sunulması, teklif edilen toplam bedelin rakam ve yazı ile birbirine uygun olarak yazılması, üzerinde kazıntı, silinti ve düzeltme yapılmaması, teklif mektubunun ad/soyad ve ticaret ünvanı yazılmak sureti ile kaşelenmesi ve imzalanması zorunlu olup, bu şartları taşımayan teklifler değerlendirilmeye alınmayacaktır.`,
            { align: 'justify' },
          );
          doc.moveDown(0.7);
          doc.font(fonts.bold).fontSize(10).text('Teklif Sahibinin');
          doc.font(fonts.regular).fontSize(10);
          doc.text(`Adı Soyadı/Ticaret Unvanı, Uyruğu : ${vendor.title}`);
          doc.text(`Açık Tebligat Adresi : ${vendor.address ?? ''}`);
          doc.text(`Bağlı Olduğu Vergi Dairesi ve Vergi Numarası : ${vendor.taxNo ?? ''}`);
          doc.text(`Telefon ve Faks Numarası : ${vendor.phone ?? ''}`);
          doc.text(`E-Mail Adresi (varsa) : ${vendor.email ?? ''}`);
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('SATIN ALINACAK MAL/MALZEME LİSTESİ');
          doc.moveDown(0.2);
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'S.No', width: 35, align: 'center' },
              { header: 'Malzemenin Adı', width: 170 },
              { header: 'Özelliği', width: 200 },
              { header: 'Miktarı', width: 60, align: 'right' },
              { header: 'Ölçeği', width: 55, align: 'center' },
              { header: 'Birim Fiyatı', width: 70, align: 'right' },
              { header: 'Tutarı (KDV Hariç)', width: 90, align: 'right' },
            ],
            items.map((it, idx) => [
              String(idx + 1),
              it.name ?? '',
              it.spec ?? '',
              String(it.qty ?? ''),
              String(it.unit ?? ''),
              '',
              '',
            ]),
            { fontSize: 7.5, headerFontSize: 7.5 },
          );
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('Diğer Hususlar');
          doc.font(fonts.regular).fontSize(9);
          doc.text('Teslim Edilecek Parti Miktarı : 1');
          doc.text('Nakliye ve Sigortanın Kime Ait Olduğu : Satıcıya');
          doc.text('Teknik Şartname : …………………………………………………………………………');
          doc.text('Uyulması Gereken Standartlar : TSE ………………………………………………');
          doc.text('Diğer Özel Şartlar : ………………………………………………………………………');
          doc.moveDown(0.6);
          doc.font(fonts.regular).fontSize(9).text(
            'Yukarıda belirtilen ve İdarenizce satın alınacak olan malların/hizmetlerin cinsi, özellikleri, miktarı ve diğer şartlarını okudum. KDV hariç toplam teklif edilen toplam bedelle vermeyi kabul ve taahhüt ediyorum/ediyoruz.',
            { align: 'justify' },
          );
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('DİĞER ŞARTLAR');
          doc.font(fonts.regular).fontSize(10).text('Tarih: ….. / ….. / 202…');
          doc.text('Teslim Süresi: 10');
          doc.moveDown(0.4);
          this.pdfSignRow(doc, fonts, [
            { role: 'Adı Soyadı, Ticaret Ünvanı', name: vendor.contactName ?? '…………………' },
            { role: 'İmza / Kaşe', name: ' ' },
          ]);
        });
        return this.persistDtGeneratedDocx({
          schoolId,
          userId,
          dtFileId,
          docType: 'teklif_isteme',
          buffer,
          filenameBase,
          filenameExtra: vendor.title,
          fileFormat: 'pdf',
        });
      }

      if (dto.doc_type === 'karar' || dto.doc_type === 'muayene_kabul_tutanagi') {
        const title = dto.doc_type === 'muayene_kabul_tutanagi' ? 'Muayene ve Kabul Komisyonu Kararı' : 'Doğrudan Temin Kararı';
        const stage = dto.doc_type === 'muayene_kabul_tutanagi' ? 'muayene_kabul' : 'komisyon_onay';
        const kararNo =
          stage === 'muayene_kabul' ? String(registry.get('muayene_kabul')?.meta?.karar_no ?? '').trim() : '';
        const muayeneSigns =
          dto.doc_type === 'muayene_kabul_tutanagi'
            ? await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: 'muayene_kabul' })
            : [];
        const buffer = await this.pdfBuffer((doc, fonts) => {
          if (dto.doc_type === 'muayene_kabul_tutanagi') {
            this.pdfOfficialTop(doc, fonts, {
              schoolId,
              school,
              file,
              stage: 'muayene_kabul',
              title: '',
              konu: '',
              showProcurementRef: false,
              registry,
              settings,
            });
            doc.font(fonts.bold).fontSize(12).text('MUAYENE KABUL KOMİSYONU', { align: 'center' });
            doc.font(fonts.bold).fontSize(13).text('MUAYENE VE KABUL KOMİSYONU KARARI', { align: 'center' });
            doc.moveDown(0.6);
            if (kararNo) doc.font(fonts.regular).fontSize(10).text(`Karar No : ${kararNo}`);
            const kararTarih = this.fmtTrDate(registry.get('muayene_kabul')?.docDate ?? null) || this.fmtTrDate(new Date());
            doc.font(fonts.regular).fontSize(10).text(`Karar Tarihi : ${kararTarih}`);
            doc.text(`İdarenin Adı : ${((school?.name ?? '').trim() || 'Kurum')} Müdürlüğü`);
            doc.text(`İşin Adı/Niteliği : ${file.subject}`);
            doc.moveDown(0.5);
            const rows = items.map((it, idx) => {
              const a = awardByItemId.get(it.id) ?? null;
              const unitPrice = a?.unitPrice ?? '';
              const total = a?.total ?? '';
              const qty = String(it.qty ?? '');
              return [
                String(idx + 1),
                qty,
                String(it.unit ?? ''),
                unitPrice,
                total,
                qty,
                '0',
              ];
            });
            this.pdfTable(
              doc,
              fonts,
              [
                { header: 'SIRA\nNO', width: 40, align: 'center' },
                { header: 'MİKTARI', width: 55, align: 'right' },
                { header: 'ÖLÇEĞİ', width: 55, align: 'center' },
                { header: 'BİRİM\nFİYATI', width: 70, align: 'right' },
                { header: 'TOPLAM\nFİYAT\n(KDV HARİÇ)', width: 85, align: 'right' },
                { header: 'KABUL\nEDİLEN\nMİKTAR', width: 75, align: 'right' },
                { header: 'KALAN', width: 45, align: 'right' },
              ],
              rows,
              { fontSize: 8, headerFontSize: 7.5 },
            );
            const sum = items.reduce((acc, it) => {
              const a = awardByItemId.get(it.id);
              const n = this.toNum(a?.total);
              return acc + (n ?? 0);
            }, 0);
            doc.font(fonts.bold).fontSize(10).text(`Toplam (KDV Hariç) ${this.fmtTry(sum)}`);
            doc.moveDown(0.6);
            doc.font(fonts.regular).fontSize(10).text(
              `İhale yetkilisince görevlendirilmemiz nedeniyle ${file.subject}’na ait yukarıda cinsi, miktarı ve tutarı belirtilen emtialar kontrolü yapılmış, alınmasında herhangi bir sakınca bulunmadığı tarafımızdan tesbit edilerek teslim alınmış ve iş bu karar tanzim ve imza edilmiştir.`,
              { align: 'justify' },
            );
            doc.moveDown(0.8);
            const blocks = muayeneSigns.length
              ? muayeneSigns.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
              : [
                  { role: 'Komisyon Üyesi', name: '…………………' },
                  { role: 'Komisyon Üyesi', name: '…………………' },
                  { role: 'Komisyon Üyesi', name: '…………………' },
                ];
            for (let i = 0; i < blocks.length; i += 3) this.pdfSignRow(doc, fonts, blocks.slice(i, i + 3));
            return;
          }

          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage,
            title: 'DOĞRUDAN TEMİN KARARI',
            registry,
            settings,
          });
          this.pdfSimpleTable(
            doc,
            fonts,
            ['No', 'Kalem', 'Miktar', 'Firma', 'BF', 'Tutar'],
            items.map((it, idx) => {
              const a = awardByItemId.get(it.id) ?? null;
              const v = a ? vendorById.get(a.vendorId) ?? null : null;
              return [
                String(idx + 1),
                `${it.name}${it.spec ? `\n${it.spec}` : ''}`,
                `${it.qty ?? ''} ${it.unit ?? ''}`.trim(),
                v?.title ?? '',
                a?.unitPrice ?? '',
                a?.total ?? '',
              ];
            }),
          );
        });
        const docType = dto.doc_type === 'muayene_kabul_tutanagi' ? 'muayene_kabul_tutanagi' : 'karar';
        return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType, buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'komisyon_onay') {
        const kindLabel: Record<string, string> = {
          yaklasik_maliyet: 'Fiyat Araştırma ve Yaklaşık Maliyet Tesbit Komisyonu Adı, Ünvanı ve Görevleri',
          piyasa_satinalma: 'Piyasa Araştırma-Satın Alma İhale Komisyonu Adı, Ünvanı ve Görevleri',
          muayene_kabul: 'Muayene ve Teslim Alma Komisyonu Adı, Ünvanı ve Görevleri',
        };
        const commTables = await Promise.all(
          DT_COMMISSION_KINDS.map(async (kind) => {
            const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId: file.id, kind } });
            if (!comm) return { kind, rows: [] as string[][] };
            const members = await this.commMemberRepo.find({ where: { commissionId: comm.id }, order: { createdAt: 'ASC' } });
            const ids = [...members.map((m) => m.userId), ...(comm.chairmanUserId ? [comm.chairmanUserId] : [])];
            const names = await this.loadUserDisplayNames(ids);
            const rows: string[][] = [];
            let n = 1;
            if (comm.chairmanUserId) {
              rows.push([
                String(n++),
                names.get(comm.chairmanUserId) ?? comm.chairmanUserId,
                '—',
                'Komisyon Başkanı',
              ]);
            }
            for (const m of members) {
              rows.push([
                String(n++),
                names.get(m.userId) ?? m.userId,
                (m.title ?? '—') as string,
                (m.dutyLabel ?? 'Komisyon Üyesi') as string,
              ]);
            }
            return { kind, rows };
          }),
        );
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'komisyon_onay',
            title: 'KOMİSYON ONAYI',
            konu: 'Yaklaşık Maliyet, Piyasa Araştırması ve Muayene Kabul Komisyon Onayı',
            showProcurementRef: false,
            registry,
            settings,
          });
          doc.font(fonts.regular).fontSize(10).text(
            `${file.subject} işine ait ihtiyaç listesi onayı ekte sunulmuştur. Söz konusu mal/malzeme 4734 sayılı İhale Kanununun 9 Maddesi gereğince satın alınacağından; (1) Her türlü fiyat araştırmasını yapmak ve yaklaşık maliyet cetvelini hazırlayarak onaya sunmak üzere fiyat araştırma komisyonu, (2) Onay Belgesi'nin tanziminden sonra yazılı teklif mektupları alarak değerlendirmek ve ihaleyi sonuçlandırarak onaya sunmak üzere ihale komisyonu, (3) Mal/malzeme tesliminden sonra satın alınan mal/malzemelerin özelliklerini ve sayılarını kontrol ederek teslim almak üzere muayene ve teslim alma komisyonu oluşturulması müdürlüğümüzce uygun görülmektedir. Makamınızca da uygun görüldüğü takdirde OLUR'larınıza arz ederim.`,
            { align: 'justify' },
          );
          doc.moveDown(0.8);
          for (const t of commTables) {
            doc.font(fonts.bold).fontSize(10).text(kindLabel[t.kind] ?? t.kind);
            doc.moveDown(0.2);
            if (!t.rows.length) {
              doc.font(fonts.regular).fontSize(10).text('(Henüz oluşturulmadı)');
              doc.moveDown(0.6);
              continue;
            }
            this.pdfTable(
              doc,
              fonts,
              [
                { header: 'Sıra No', width: 50, align: 'center' },
                { header: 'Adı Soyadı', width: 170 },
                { header: 'Ünvanı', width: 130 },
                { header: 'Görevi', width: 140 },
              ],
              t.rows,
              { fontSize: 8.5, headerFontSize: 8.5 },
            );
            doc.moveDown(0.4);
          }
          doc.moveDown(0.2);
          this.pdfSignRow(doc, fonts, [
            {
              role: '(İhale/Harcama Yetkilisi)',
              name: settings?.realizationAuthorityName ?? '…………………',
              title: settings?.realizationAuthorityTitle ?? undefined,
            },
          ]);
          doc.moveDown(0.2);
          doc.font(fonts.bold).fontSize(10).text('OLUR', { align: 'center' });
          const d = this.fmtTrDate(registry.get('komisyon_onay')?.docDate ?? null) || this.fmtTrDate(new Date());
          if (d) doc.font(fonts.regular).fontSize(10).text(d, { align: 'center' });
          this.pdfSignRow(doc, fonts, [
            {
              role: 'İhale(Harcama Yetkilisi)',
              name: settings?.spendingAuthorityName ?? (school?.principalName ?? '…………………'),
              title: settings?.spendingAuthorityTitle ?? undefined,
            },
          ]);
        });
        return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'komisyon_onay', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'onay_belgesi') {
        const onayReg = registry.get('ihale_onay');
        const belgeTarih = this.fmtTrDate(onayReg?.docDate ?? null) || this.fmtTrDate(new Date());
        const belgeSayi = this.registrySayi(onayReg);

        const research = await this.quoteRepo.find({
          where: { schoolId, dtFileId, purpose: 'market_research' },
          order: { createdAt: 'ASC' },
          take: 5,
        });
        const firmQuotes = research.slice(0, 3);
        const firmTotals = await Promise.all(
          firmQuotes.map(async (q) => {
            const qis = await this.quoteItemRepo.find({ where: { quoteId: q.id } });
            const byItem = new Map(qis.map((x) => [x.dtItemId, this.toNum(x.unitPrice)] as const));
            const total = items.reduce((acc, it) => acc + (byItem.get(it.id) ?? 0) * (this.toNum(it.qty) ?? 0), 0);
            return total;
          }),
        );
        const avgTotal = firmTotals.length ? firmTotals.reduce((a, b) => a + b, 0) / firmTotals.length : 0;
        const approxText = file.approxTotal ?? this.fmtTry(avgTotal);

        const assigned = await (async () => {
          const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId: file.id, kind: 'yaklasik_maliyet' } });
          if (!comm) return [] as string[][];
          const members = await this.commMemberRepo.find({ where: { commissionId: comm.id }, order: { createdAt: 'ASC' } });
          const ids = [...members.map((m) => m.userId), ...(comm.chairmanUserId ? [comm.chairmanUserId] : [])];
          const names = await this.loadUserDisplayNames(ids);
          const out: string[][] = [];
          if (comm.chairmanUserId) out.push([names.get(comm.chairmanUserId) ?? comm.chairmanUserId, 'Komisyon Üyesi', '—']);
          for (const m of members) out.push([names.get(m.userId) ?? m.userId, (m.dutyLabel ?? 'Komisyon Üyesi') as string, (m.title ?? '—') as string]);
          return out;
        })();
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfAntet(doc, fonts, school, settings);
          doc.font(fonts.bold).fontSize(13).text('ONAY BELGESİ', { align: 'center' });
          doc.moveDown(0.6);

          doc.font(fonts.regular).fontSize(10);
          doc.text(`Doğrudan Temini Yapan İdarenin Adı: ${settings?.headerLine3?.trim() || 'İlçe Milli Eğitim Müdürlüğü'}`);
          doc.text(`Belge Tarih ve Sayısı: ${belgeTarih} ${belgeSayi}`.trim());
          doc.text(`İşin Niteliği: ${file.subject}`);
          doc.text(`İşin Miktarı: Ekli belgede gösterilmiştir.`);
          doc.text(`Yaklaşık Maliyet (KDV Hariç)(₺): ${approxText}`);
          doc.text(`Bütçe Tertibi: ${''}`);
          doc.text(`İhale Usulü: 4734 Sayılı Kamu İhale Kanunu'nun 22/d Maddesi`);
          doc.text(`İlanın Şekli ve Adedi: Yapılmayacak`);
          doc.text(`Sözleşme Düzenlenip Düzenlenmeyeceği: Düzenlenmeyecektir`);
          doc.text(`Şartname Düzenlenip Düzenlenmeyeceği: Düzenlenecektir`);
          doc.text(`Yeterlilik Kriterleri Aranıp Aranmayacağı: Aranmayacaktır`);
          doc.moveDown(0.6);

          doc.font(fonts.bold).fontSize(10).text('Doğrudan Temin Usulü ile Mal ve Hizmet satın alınacaksa piyasa fiyat araştırması yapmak üzere görevlendirilecek kişi/kişiler');
          doc.moveDown(0.2);
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'Adı Soyadı', width: 210 },
              { header: 'Görevi', width: 150 },
              { header: 'Ünvanı', width: 150 },
            ],
            assigned.length ? assigned : [['—', '—', '—']],
            { fontSize: 9, headerFontSize: 9 },
          );

          if (file.procurementRef?.trim()) doc.font(fonts.regular).fontSize(10).text(`Doğrudan Temin Numarası ${file.procurementRef.trim()}`);
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('DİĞER AÇIKLAMALAR');
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('ONAY', { align: 'center' });
          doc.font(fonts.regular).fontSize(10).text('Yukarıda belirtilen mal/malzeme/hizmetin satın alınması için ilgililerin görevlendirilmeleri hususu UYGUNDUR', { align: 'center' });
          doc.moveDown(0.6);
          const d = belgeTarih || this.fmtTrDate(new Date());
          this.pdfSignRow(doc, fonts, [
            {
              role: d,
              name: settings?.realizationAuthorityName ?? '…………………',
              title: settings?.realizationAuthorityTitle ?? undefined,
            },
            {
              role: d,
              name: settings?.spendingAuthorityName ?? (school?.principalName ?? '…………………'),
              title: settings?.spendingAuthorityTitle ?? undefined,
            },
          ]);
        });
        return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'onay_belgesi', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'piyasa_arastirma_tutanagi' || dto.doc_type === 'yaklasik_maliyet_cetveli') {
        const research = await this.quoteRepo.find({
          where: { schoolId, dtFileId, purpose: 'market_research' },
          order: { createdAt: 'ASC' },
          take: 5,
        });
        const firmQuotes = research.slice(0, 3);
        const cols = await Promise.all(
          firmQuotes.map(async (q, idx) => {
            const qis = await this.quoteItemRepo.find({ where: { quoteId: q.id }, order: { createdAt: 'ASC' } });
            const byItem = new Map(qis.map((x) => [x.dtItemId, this.toNum(x.unitPrice)] as const));
            const v = vendorById.get(q.vendorId) ?? null;
            const title = v?.title?.trim() || `${idx + 1}. FİRMASI`;
            const total = items.reduce((acc, it) => acc + (byItem.get(it.id) ?? 0) * (this.toNum(it.qty) ?? 0), 0);
            return { vendor: v, title, byItem, total };
          }),
        );
        const stage = dto.doc_type === 'piyasa_arastirma_tutanagi' ? 'piyasa_arastirma' : 'yaklasik_maliyet';
        const commKind = dto.doc_type === 'piyasa_arastirma_tutanagi' ? 'piyasa_satinalma' : 'yaklasik_maliyet';
        const commSigns = await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: commKind });
        const avgTotal = cols.length ? cols.reduce((a, c) => a + (c.total ?? 0), 0) / cols.length : 0;
        const lowest = cols.length ? cols.reduce((a, b) => (a.total <= b.total ? a : b)) : null;
        const onay = registry.get('ihale_onay');
        const onayTarih = this.fmtTrDate(onay?.docDate ?? null);
        const onaySayi = this.registrySayi(onay);
        const buffer = await this.pdfBuffer((doc, fonts) => {
          if (dto.doc_type === 'yaklasik_maliyet_cetveli') {
            this.pdfAntet(doc, fonts, school, settings);
            doc.font(fonts.bold).fontSize(13).text('YAKLAŞIK MALİYET CETVELİ', { align: 'center' });
            doc.moveDown(0.6);
            doc.font(fonts.regular).fontSize(10);
            doc.text(`İdarenin Adı: ${((school?.name ?? '').trim() || 'Kurum')} Müdürlüğü`);
            doc.text(`İşin Konusu: ${file.subject}`);
            const d = this.fmtTrDate(registry.get('yaklasik_maliyet')?.docDate ?? null) || this.fmtTrDate(new Date());
            doc.text(`Düzenleme Tarihi: ${d}`);
            if (file.procurementRef?.trim()) doc.text(`Doğrudan Temin Numarası: ${file.procurementRef.trim()}`);
            doc.moveDown(0.6);

            const baseCols = [
              { header: 'Sıra\nNo', width: 35, align: 'center' as const },
              { header: 'Malzemenin Adı', width: 140 },
              { header: 'Özelliği', width: 160 },
              { header: 'Miktarı', width: 50, align: 'right' as const },
              { header: 'Ölçüsü', width: 50, align: 'center' as const },
            ];
            const firmCols = cols.flatMap((c, i) => [
              { header: `${String.fromCharCode(65 + i)} FİRMASI\nBirim Fiyatı`, width: 65, align: 'right' as const },
              { header: `${String.fromCharCode(65 + i)} FİRMASI\nToplam Fiyat`, width: 70, align: 'right' as const },
            ]);
            const approxCols = [
              { header: 'Birim\nYaklaşık\nMaliyet\nFiyatı', width: 70, align: 'right' as const },
              { header: 'Toplam\nYaklaşık\nMaliyet\nFiyatı', width: 80, align: 'right' as const },
            ];
            const tableCols = [...baseCols, ...firmCols, ...approxCols];

            const rows = items.map((it, idx) => {
              const qty = this.toNum(it.qty) ?? 0;
              const prices = cols.map((c) => c.byItem.get(it.id) ?? null);
              const totals = prices.map((p) => (p == null ? null : p * qty));
              const avgUnit = prices.filter((p): p is number => typeof p === 'number').reduce((a, b) => a + b, 0) / (prices.filter((p) => typeof p === 'number').length || 1);
              const avgLine = avgUnit * qty;
              return [
                String(idx + 1),
                it.name ?? '',
                it.spec ?? '',
                String(it.qty ?? ''),
                String(it.unit ?? ''),
                ...cols.flatMap((c) => {
                  const p = c.byItem.get(it.id);
                  const t = p == null ? null : p * qty;
                  return [
                    p == null ? '' : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p),
                    t == null ? '' : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t),
                  ];
                }),
                Number.isFinite(avgUnit) ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(avgUnit) : '',
                Number.isFinite(avgLine) ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(avgLine) : '',
              ];
            });

            this.pdfTable(doc, fonts, tableCols, rows, { fontSize: 6.8, headerFontSize: 6.6, rowPaddingY: 2 });
            doc.moveDown(0.2);
            if (cols.length) {
              const totalsLine = cols
                .map((c, i) => `TOPLAM ${String.fromCharCode(65 + i)}: ${this.fmtTry(c.total)}`)
                .join('   ');
              doc.font(fonts.bold).fontSize(9).text(`${totalsLine}   YAKLAŞIK: ${this.fmtTry(avgTotal)}`);
            }
            doc.moveDown(0.6);
            doc.font(fonts.regular).fontSize(9).text(
              `İdaremizce ihtiyaç duyulan ve satın alınması düşünülen aşağıda cinsi, özellikleri ve miktarları yazılı malların/hizmetlerin 4734 Sayılı Kamu İhale Kanunu'nun 9'uncu Maddesi gereğince yaklaşık maliyetinin tesbitine esas olmak üzere her türlü fiyat araştırması yapılmıştır. Araştırma sonuçları yukarıdaki tabloda gösterilmiştir. Yukarıda açıklandığı üzere yaklaşık maliyetin KDV hariç ${this.fmtTry(avgTotal)} takdir ve tesbit edilerek iş bu Hesap Cetveli düzenlenerek imza altına alınmıştır.`,
              { align: 'justify' },
            );
            doc.moveDown(0.6);
            doc.font(fonts.bold).fontSize(10).text('YAKLAŞIK MALİYETİ YAPAN GÖREVLİ/GÖREVLİLER');
            doc.moveDown(0.4);
            const blocks = commSigns.length
              ? commSigns.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
              : [
                  { role: 'Komisyon Üyesi', name: '…………………' },
                  { role: 'Komisyon Üyesi', name: '…………………' },
                  { role: 'Komisyon Üyesi', name: '…………………' },
                ];
            for (let i = 0; i < blocks.length; i += 3) this.pdfSignRow(doc, fonts, blocks.slice(i, i + 3));
            return;
          }

          this.pdfAntet(doc, fonts, school, settings);
          doc.font(fonts.bold).fontSize(13).text('PİYASA FİYAT ARAŞTIRMA TUTANAĞI', { align: 'center' });
          doc.moveDown(0.6);
          doc.font(fonts.regular).fontSize(10);
          doc.text(`İdarenin Adı: ${((school?.name ?? '').trim() || 'Kurum')} Müdürlüğü`);
          doc.text(`Yapılan İş/Mal/Hizmetin Adı, Niteliği: ${file.subject}`);
          doc.text(
            `Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi/Görevlendirme Onayı Tarih ve No.su: ${[onayTarih, onaySayi].filter(Boolean).join(' ')}`.trim(),
          );
          if (file.procurementRef?.trim()) doc.text(`Doğrudan Temin Numarası ${file.procurementRef.trim()}`);
          doc.moveDown(0.6);

          const baseCols = [
            { header: 'Sıra\nNo', width: 35, align: 'center' as const },
            { header: 'Mal/Malzemenin Adı', width: 140 },
            { header: 'Özelliği', width: 160 },
            { header: 'Miktarı', width: 50, align: 'right' as const },
            { header: 'Ölçüsü', width: 50, align: 'center' as const },
          ];
          const firmCols = cols.flatMap((c, i) => [
            { header: `${i + 1}. FİRMASI\nBirim Fiyat`, width: 70, align: 'right' as const },
            { header: `${i + 1}. FİRMASI\nToplam Fiyat`, width: 75, align: 'right' as const },
          ]);
          const tableCols = [...baseCols, ...firmCols];

          const rows = items.map((it, idx) => {
            const qty = this.toNum(it.qty) ?? 0;
            return [
              String(idx + 1),
              it.name ?? '',
              it.spec ?? '',
              String(it.qty ?? ''),
              String(it.unit ?? ''),
              ...cols.flatMap((c) => {
                const p = c.byItem.get(it.id);
                const t = p == null ? null : p * qty;
                return [
                  p == null ? '' : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p),
                  t == null ? '' : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t),
                ];
              }),
            ];
          });
          this.pdfTable(doc, fonts, tableCols, rows, { fontSize: 6.8, headerFontSize: 6.6, rowPaddingY: 2 });
          doc.moveDown(0.4);
          if (cols.length) {
            const totalsLine = cols
              .map((c, i) => `TOPLAM TEKLİF ${i + 1}: ${this.fmtTry(c.total)}`)
              .join('   ');
            doc.font(fonts.bold).fontSize(9).text(totalsLine);
          }
          doc.moveDown(0.6);
          if (lowest) {
            doc.font(fonts.bold).fontSize(10).text('Tümünün Bu Kişi/Firmadan Alımı Uygun Görülmüştür');
            doc.font(fonts.regular).fontSize(10).text(`${lowest.title}${lowest.vendor?.address ? `  ${lowest.vendor.address}` : ''}  ${this.fmtTry(lowest.total)}`);
          }
          doc.moveDown(0.4);
          doc.font(fonts.regular).fontSize(9).text(
            `4734 Sayılı Kamu İhale Kanunu'nun 22 nci Maddesi uyarınca Doğrudan Temin Usulüyle yapılacak alımlara ilişkin yapılan piyasa araştırmasında firmalarca/kişilerce teklif edilen fiyatlar değerlendirilerek yukarıda adı ve adresleri belirtilen kişi/firma/firmalardan alım yapılması uygun görülmüştür.`,
            { align: 'justify' },
          );
          doc.moveDown(0.8);
          const blocks = commSigns.length
            ? commSigns.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
            : [
                { role: 'Komisyon Üyesi', name: '…………………' },
                { role: 'Komisyon Üyesi', name: '…………………' },
                { role: 'Komisyon Üyesi', name: '…………………' },
              ];
          for (let i = 0; i < blocks.length; i += 3) this.pdfSignRow(doc, fonts, blocks.slice(i, i + 3));
        });
        const docType = dto.doc_type;
        return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType, buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'teknik_sartname') {
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfAntet(doc, fonts, school, settings);
          doc.font(fonts.bold).fontSize(13).text('TEKNİK ŞARTNAME', { align: 'center' });
          doc.moveDown(0.8);
          doc.font(fonts.regular).fontSize(10);
          doc.text(`İdare : ${((school?.name ?? '').trim() || 'Kurum')} Müdürlüğü`);
          doc.text(`Firma : İş için fiyat araştırması/teklif veren gerçek ve tüzel kişi`);
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('Satın Alım Konusu İşe İlişkin Bilgiler');
          doc.font(fonts.regular).fontSize(10).text(`İşin Adı : ${file.subject}`);
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('Satın Alıma İlişkin Genel Koşullar');
          doc.font(fonts.regular).fontSize(9).text(
            `* Satın alınacak ürün/ürünlerin özelliklerinin en az teknik şartnamede belirtilmiş özelliklerde olması ön koşuldur.\n* Müdürlüğümüzün ihtiyaçlarının tam, kaliteli, talebi karşılar nitelikte, sıfır ve kullanılmamış ürünlerden karşılanması öncelikli şarttır.\n* Firmalar tüm ürün/hizmete ait garanti sürelerini tekliflerinde açıkça ve ayrıca belirtecektir.\n* Tekliflerinizde ürünlerin teslimat tarihlerine ait bilgiler mutlaka bildirilmelidir.\n* Müdürlüğümüz tarafından numune talep edilmesi halinde firma numune sağlamak durumundadır. Tüm nakliye, navlun, sigorta, gümrük, benzeri maliyetler ve tüm vergiler firma tarafından ödenir.\n* Satın alımımıza ait şartname maddelerinin tümüne teklif verilecektir. Ayrı ayrı, parçalı ve alternatif teklif verilemez.\n* Alımla ilgili tüm dokümanlar kaşelenmeli ve imzalanarak onaylanmalıdır.\n* Firma, resmi teklifinde belirtmiş olduğu ürün fiyatları haricinde başka hiçbir koşul veya isim altında bedel talep etmeyecektir.\n* İşbu dokümandan doğan/doğacak damga vergisi firma tarafından ödenecektir.`,
            { align: 'left' },
          );
          doc.moveDown(0.6);
          doc.font(fonts.bold).fontSize(10).text('Satın Alınacak Mal/Malzeme Listesi');
          doc.moveDown(0.2);
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'Sıra No', width: 50, align: 'center' },
              { header: 'Mal/Malzemenin Adı', width: 180 },
              { header: 'Teknik Özellikleri', width: 260 },
            ],
            items.map((it, idx) => [String(idx + 1), it.name ?? '', it.spec ?? '—']),
            { fontSize: 9, headerFontSize: 9 },
          );
          doc.moveDown(0.8);
          const d = this.fmtTrDate(new Date());
          doc.font(fonts.regular).fontSize(10).text(d, { align: 'right' });
          doc.moveDown(0.2);
          this.pdfSignRow(doc, fonts, [
            {
              role: 'İhale(Harcama Yetkilisi)',
              name: settings?.spendingAuthorityName ?? (school?.principalName ?? '…………………'),
              title: settings?.spendingAuthorityTitle ?? undefined,
            },
            { role: 'FİRMA/KAŞE', name: ' ' },
          ]);
        });
        return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'teknik_sartname', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'teslim_tesellum_tutanagi') {
        const awardedVendorId = awards[0]?.vendorId ?? '';
        const awardedVendor = awardedVendorId ? vendorById.get(awardedVendorId) ?? null : null;
        const buffer = await this.pdfBuffer((doc, fonts) => {
          doc.font(fonts.bold).fontSize(10).text('EK-1');
          doc.moveDown(0.4);
          doc.font(fonts.bold).fontSize(12).text('ÖDEME BELGESİ VE EKİ BELGELER TESLİM/TESELLÜM TUTANAĞI', { align: 'center' });
          doc.moveDown(0.8);
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'Kanıtlayıcı Belge Türü', width: 230 },
              { header: 'Eki Belge', width: 170 },
              { header: 'Hak Sahibi', width: 190 },
            ],
            [
              ['Ödeme Emri Belgesi', '', awardedVendor?.title ?? '—'],
              ['Muayene Kabul', '', awardedVendor?.title ?? '—'],
              ['Piyasa Araştırma Tutanağı', '', awardedVendor?.title ?? '—'],
              ['Onay Belgesi', '', awardedVendor?.title ?? '—'],
              ['Yaklaşık Maliyet', '', awardedVendor?.title ?? '—'],
              ['Taşınır İşlem Fişi', '', awardedVendor?.title ?? '—'],
              ['Fatura', '', awardedVendor?.title ?? '—'],
              ['Borcu Yoktur Belgesi', '', awardedVendor?.title ?? '—'],
            ],
            { fontSize: 9, headerFontSize: 9 },
          );
          doc.moveDown(0.6);
          doc.font(fonts.regular).fontSize(9).text(
            'Yukarıda hak sahipleri ile alacak tutarları gösterilen tahakkuk evrakı ve eki evraklar teslim alınmıştır. …../……/202…  Teslim Saati: ………',
          );
          doc.moveDown(0.8);
          this.pdfSignRow(doc, fonts, [
            { role: 'TESLİM EDEN', name: settings?.realizationAuthorityName ?? '…………………', title: settings?.realizationAuthorityTitle ?? undefined },
            { role: 'TESLİM ALAN', name: '…………………', title: undefined },
          ]);
        });
        return this.persistDtGeneratedDocx({
          schoolId,
          userId,
          dtFileId,
          docType: 'teslim_tesellum_tutanagi',
          buffer,
          filenameBase,
          fileFormat: 'pdf',
        });
      }

      if (dto.doc_type === 'sozlesme') {
        throw new BadRequestException({ code: 'DT_PDF_NOT_SUPPORTED', message: 'Sözleşme için PDF desteklenmiyor.' });
      }
    }

    if (dto.doc_type === 'ihtiyac_listesi') {
      const buffer = await this.buildIhtiyacListesiDocx({ school, file, items, letterhead });
      return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'ihtiyac_listesi', buffer, filenameBase, fileFormat: 'docx' });
    }

    if (dto.doc_type === 'teklif_isteme') {
      const vendorId = String(dto.vendor_id ?? '').trim();
      if (!vendorId) throw new BadRequestException({ code: 'DT_VENDOR_ID_REQUIRED' });
      const vendor = vendorById.get(vendorId);
      if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
      const buffer = await this.buildTeklifIstemeDocx({ school, file, items, vendor, letterhead });
      return this.persistDtGeneratedDocx({
        schoolId,
        userId,
        dtFileId,
        docType: 'teklif_isteme',
        buffer,
        filenameBase,
        filenameExtra: vendor.title,
        fileFormat: 'docx',
      });
    }

    if (dto.doc_type === 'fiyat_arastirmasi' || dto.doc_type === 'teknik_sartname' || dto.doc_type === 'teslim_tesellum_tutanagi') {
      throw new BadRequestException({ code: 'DT_DOCX_NOT_SUPPORTED', message: 'Bu belge türü için DOCX desteklenmiyor.' });
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
      const buffer = await this.buildSozlesmeDocx({ school, file, vendor, awarded, letterhead });
      return this.persistDtGeneratedDocx({
        schoolId,
        userId,
        dtFileId,
        docType: 'sozlesme',
        buffer,
        filenameBase,
        filenameExtra: vendor.title,
        fileFormat: 'docx',
      });
    }

    if (dto.doc_type === 'komisyon_onay') {
      const buffer = await this.buildKomisyonOnayDocx(schoolId, school, file, letterhead);
      return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'komisyon_onay', buffer, filenameBase, fileFormat: 'docx' });
    }

    if (dto.doc_type === 'onay_belgesi') {
      const buffer = await this.buildOnayBelgesiDocx(schoolId, school, file, letterhead);
      return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'onay_belgesi', buffer, filenameBase, fileFormat: 'docx' });
    }

    if (dto.doc_type === 'piyasa_arastirma_tutanagi') {
      const research = await this.quoteRepo.find({
        where: { schoolId, dtFileId, purpose: 'market_research' },
        order: { createdAt: 'ASC' },
        take: 5,
      });
      const buffer = await this.buildQuoteFirmMatrixDocx({
        letterhead,
        file,
        items,
        vendorById,
        quotes: research,
        docTitle: 'Piyasa araştırma tutanağı',
      });
      return this.persistDtGeneratedDocx({
        schoolId,
        userId,
        dtFileId,
        docType: 'piyasa_arastirma_tutanagi',
        buffer,
        filenameBase,
        fileFormat: 'docx',
      });
    }

    if (dto.doc_type === 'yaklasik_maliyet_cetveli') {
      const research = await this.quoteRepo.find({
        where: { schoolId, dtFileId, purpose: 'market_research' },
        order: { createdAt: 'ASC' },
        take: 5,
      });
      const buffer = await this.buildQuoteFirmMatrixDocx({
        letterhead,
        file,
        items,
        vendorById,
        quotes: research,
        docTitle: 'Yaklaşık maliyet cetveli',
      });
      return this.persistDtGeneratedDocx({
        schoolId,
        userId,
        dtFileId,
        docType: 'yaklasik_maliyet_cetveli',
        buffer,
        filenameBase,
        fileFormat: 'docx',
      });
    }

    if (dto.doc_type === 'muayene_kabul_tutanagi') {
      const buffer = await this.buildKararDocx({
        school,
        file,
        items,
        awardByItemId,
        vendorById,
        letterhead,
        docTitle: 'Muayene ve kabul tutanağı',
      });
      return this.persistDtGeneratedDocx({
        schoolId,
        userId,
        dtFileId,
        docType: 'muayene_kabul_tutanagi',
        buffer,
        filenameBase,
        fileFormat: 'docx',
      });
    }

    if (dto.doc_type === 'karar') {
      const buffer = await this.buildKararDocx({
        school,
        file,
        items,
        awardByItemId,
        vendorById,
        letterhead,
        docTitle: 'Doğrudan temin kararı',
      });
      return this.persistDtGeneratedDocx({ schoolId, userId, dtFileId, docType: 'karar', buffer, filenameBase, fileFormat: 'docx' });
    }

    throw new BadRequestException({ code: 'DT_INVALID_DOC_TYPE' });
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

  private async buildKomisyonOnayDocx(
    schoolId: string,
    school: Pick<School, 'name' | 'principalName'> | null,
    file: DtFile,
    letterhead: Paragraph[],
  ): Promise<Buffer> {
    const kindLabel: Record<string, string> = {
      yaklasik_maliyet: 'Yaklaşık maliyet komisyonu',
      piyasa_satinalma: 'Piyasa araştırma / satın alma komisyonu',
      muayene_kabul: 'Muayene ve kabul komisyonu',
    };
    const sections: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: 'Komisyon üye listesi / onay', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo} · ${file.subject}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];
    for (const kind of DT_COMMISSION_KINDS) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: kindLabel[kind] ?? kind, bold: true, size: 20 })],
        }),
      );
      const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId: file.id, kind } });
      if (!comm) {
        sections.push(new Paragraph({ children: [new TextRun({ text: '(Henüz oluşturulmadı)', italics: true, size: 18 })] }));
        sections.push(new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }));
        continue;
      }
      const members = await this.commMemberRepo.find({ where: { commissionId: comm.id }, order: { createdAt: 'ASC' } });
      const ids = [...members.map((m) => m.userId), ...(comm.chairmanUserId ? [comm.chairmanUserId] : [])];
      const names = await this.loadUserDisplayNames(ids);
      if (comm.chairmanUserId) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Başkan: ', bold: true, size: 18 }),
              new TextRun({ text: names.get(comm.chairmanUserId) ?? comm.chairmanUserId, size: 18 }),
            ],
          }),
        );
      }
      members.forEach((m, i) => {
        const line = `${i + 1}. ${names.get(m.userId) ?? m.userId} — ${m.dutyLabel ?? m.title ?? 'Üye'}`;
        sections.push(new Paragraph({ children: [new TextRun({ text: line, size: 18 })] }));
      });
      sections.push(new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }));
    }
    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...letterhead, ...sections] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildOnayBelgesiDocx(
    schoolId: string,
    school: Pick<School, 'name' | 'principalName'> | null,
    file: DtFile,
    letterhead: Paragraph[],
  ): Promise<Buffer> {
    const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId } });
    const lines: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: 'Onay belgesi (taslak)', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo} · ${file.subject}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Yaklaşık maliyet toplamı: ${file.approxTotal ?? '—'}   Karar toplamı: ${file.decisionTotal ?? '—'}`,
            size: 18,
          }),
        ],
      }),
    ];
    if (settings?.spendingAuthorityName?.trim()) {
      lines.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Harcama yetkilisi: ${settings.spendingAuthorityName.trim()}${settings.spendingAuthorityTitle ? ` (${settings.spendingAuthorityTitle})` : ''}`,
              size: 18,
            }),
          ],
        }),
      );
    }
    if (settings?.realizationAuthorityName?.trim()) {
      lines.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Gerçekleştirme görevlisi: ${settings.realizationAuthorityName.trim()}${settings.realizationAuthorityTitle ? ` (${settings.realizationAuthorityTitle})` : ''}`,
              size: 18,
            }),
          ],
        }),
      );
    }
    lines.push(
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({
        children: [new TextRun({ text: `Müdür / yetkili: ${school?.principalName ?? '…………………'}`, size: 18 })],
      }),
    );
    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...letterhead, ...lines] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildQuoteFirmMatrixDocx(input: {
    letterhead: Paragraph[];
    file: DtFile;
    items: DtItem[];
    vendorById: Map<string, DtVendor>;
    quotes: DtQuote[];
    docTitle: string;
  }): Promise<Buffer> {
    const { letterhead, file, items, vendorById, quotes, docTitle } = input;
    const firmQuotes = quotes.slice(0, 3);
    const colData = await Promise.all(
      firmQuotes.map(async (q) => {
        const qis = await this.quoteItemRepo.find({ where: { quoteId: q.id }, order: { createdAt: 'ASC' } });
        const byItem = new Map(qis.map((x) => [x.dtItemId, x.unitPrice]));
        const title = vendorById.get(q.vendorId)?.title ?? q.vendorId;
        return { title, byItem };
      }),
    );
    const th = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 16 })] })], shading: { fill: 'E8ECF0' } as any });
    const td = (t: string) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 16 })] })] });
    const headerRow = new TableRow({
      children: [
        th('No'),
        th('Kalem'),
        th('Miktar'),
        ...colData.map((c) => th(c.title.slice(0, 40))),
      ],
    });
    const dataRows = items.map((it, idx) => {
      const cells = [
        td(String(idx + 1)),
        td(`${it.name}${it.spec ? `\n${it.spec}` : ''}`),
        td(`${it.qty ?? ''} ${it.unit ?? ''}`.trim()),
        ...colData.map((c) => td(String(c.byItem.get(it.id) ?? ''))),
      ];
      return new TableRow({ children: cells });
    });
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      },
    });
    const sub: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: docTitle, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${file.year} / ${file.fileNo} · ${file.subject}`, size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];
    if (!firmQuotes.length) {
      sub.push(new Paragraph({ children: [new TextRun({ text: 'Fiyat araştırması teklifi yok; önce «Araştırma» amaçlı teklif ekleyin.', italics: true, size: 18 })] }));
    }
    const doc = new DocxDocument({ sections: [{ properties: {}, children: [...letterhead, ...sub, table] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildIhtiyacListesiDocx(input: {
    school: Pick<School, 'name' | 'principalName'> | null;
    file: DtFile;
    items: DtItem[];
    letterhead: Paragraph[];
  }): Promise<Buffer> {
    const { file, items, letterhead } = input;
    const header = [
      ...letterhead,
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
    letterhead: Paragraph[];
    docTitle: string;
  }): Promise<Buffer> {
    const { school, file, items, awardByItemId, vendorById, letterhead, docTitle } = input;
    const header = [
      ...letterhead,
      new Paragraph({ children: [new TextRun({ text: docTitle, bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
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
    letterhead: Paragraph[];
  }): Promise<Buffer> {
    const { file, items, vendor, letterhead } = input;
    const header = [
      ...letterhead,
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
    letterhead: Paragraph[];
  }): Promise<Buffer> {
    const { school, file, vendor, awarded, letterhead } = input;
    const total = awarded.reduce((sum, x) => sum + (Number(x.a.total) || 0), 0);
    const header = [
      ...letterhead,
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

  async getSchoolProcurementSettings(schoolId: string) {
    let row = await this.procurementSettingsRepo.findOne({ where: { schoolId } });
    if (!row) {
      row = this.procurementSettingsRepo.create({ schoolId });
      await this.procurementSettingsRepo.save(row);
    }
    return row;
  }

  async patchSchoolProcurementSettings(schoolId: string, dto: PatchDtSchoolProcurementSettingsDto) {
    let row = await this.procurementSettingsRepo.findOne({ where: { schoolId } });
    if (!row) row = this.procurementSettingsRepo.create({ schoolId });
    if (dto.header_line2 !== undefined) row.headerLine2 = dto.header_line2?.trim() || null;
    if (dto.header_line3 !== undefined) row.headerLine3 = dto.header_line3?.trim() || null;
    if (dto.header_line4 !== undefined) row.headerLine4 = dto.header_line4?.trim() || null;
    if (dto.spending_authority_name !== undefined) row.spendingAuthorityName = dto.spending_authority_name?.trim() || null;
    if (dto.spending_authority_title !== undefined) row.spendingAuthorityTitle = dto.spending_authority_title?.trim() || null;
    if (dto.realization_authority_name !== undefined) row.realizationAuthorityName = dto.realization_authority_name?.trim() || null;
    if (dto.realization_authority_title !== undefined) row.realizationAuthorityTitle = dto.realization_authority_title?.trim() || null;
    if (dto.official_correspondence_code !== undefined) row.officialCorrespondenceCode = dto.official_correspondence_code?.trim() || null;
    return this.procurementSettingsRepo.save(row);
  }

  async listDocumentRegistry(schoolId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const saved = await this.registryRepo.find({ where: { schoolId, dtFileId } });
    const byStage = new Map(saved.map((r) => [r.stage, r]));
    const entries = DT_REGISTRY_STAGES.map((stage) => {
      const r = byStage.get(stage);
      return (
        r ?? {
          stage,
          docDate: null,
          numberPrefix: null,
          numberSuffix: null,
          meta: {},
        }
      );
    });
    return { entries };
  }

  async putDocumentRegistry(schoolId: string, userId: string, dtFileId: string, dto: PutDtDocumentRegistryDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    void userId;
    for (const e of dto.entries) {
      const existing = await this.registryRepo.findOne({ where: { schoolId, dtFileId, stage: e.stage } });
      const row = this.registryRepo.create({
        ...(existing ? { id: existing.id } : {}),
        schoolId,
        dtFileId,
        stage: e.stage,
        docDate: e.doc_date?.trim() ? e.doc_date.trim().slice(0, 10) : null,
        numberPrefix: e.number_prefix?.trim() || null,
        numberSuffix: e.number_suffix?.trim() || null,
        meta: e.meta && typeof e.meta === 'object' ? e.meta : {},
      });
      await this.registryRepo.save(row);
    }
    return this.listDocumentRegistry(schoolId, dtFileId);
  }

  async listCommissionsByFile(schoolId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const commissions = await this.commissionRepo.find({ where: { schoolId, dtFileId }, order: { kind: 'ASC' } });
    const out: Array<{ commission: DtAcceptanceCommission; members: DtAcceptanceCommissionMember[] }> = [];
    for (const c of commissions) {
      const members = await this.commMemberRepo.find({ where: { commissionId: c.id }, order: { createdAt: 'ASC' } });
      out.push({ commission: c, members });
    }
    return { commissions: out };
  }

  async copyResearchQuotesToBid(schoolId: string, userId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const research = await this.quoteRepo.find({ where: { schoolId, dtFileId, purpose: 'market_research' } });
    let created = 0;
    for (const rq of research) {
      const existsBid = await this.quoteRepo.findOne({
        where: { schoolId, dtFileId, vendorId: rq.vendorId, purpose: 'bid' },
        select: ['id'],
      });
      if (existsBid) continue;
      const nq = await this.quoteRepo.save(
        this.quoteRepo.create({
          schoolId,
          dtFileId,
          vendorId: rq.vendorId,
          purpose: 'bid',
          status: 'requested',
          requestedAt: new Date(),
          receivedAt: null,
          note: null,
          createdByUserId: userId,
          updatedByUserId: userId,
        }),
      );
      const qis = await this.quoteItemRepo.find({ where: { quoteId: rq.id } });
      if (qis.length) {
        await this.quoteItemRepo.save(
          qis.map((qi) =>
            this.quoteItemRepo.create({
              schoolId,
              quoteId: nq.id,
              dtItemId: qi.dtItemId,
              unitPrice: qi.unitPrice,
              total: qi.total,
            }),
          ),
        );
      }
      created += 1;
    }
    if (created) await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return { created, total_research: research.length };
  }

  async syncCommissionMembers(schoolId: string, userId: string, dtFileId: string, dto: SyncDtCommissionDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const from = await this.commissionRepo.findOne({ where: { schoolId, dtFileId, kind: dto.from_kind } });
    if (!from) throw new NotFoundException({ code: 'DT_COMMISSION_NOT_FOUND' });
    const srcMembers = await this.commMemberRepo.find({ where: { commissionId: from.id } });
    for (const toKind of dto.to_kinds) {
      if (toKind === dto.from_kind) continue;
      let to = await this.commissionRepo.findOne({ where: { schoolId, dtFileId, kind: toKind } });
      if (!to) {
        to = await this.commissionRepo.save(
          this.commissionRepo.create({
            schoolId,
            dtFileId,
            kind: toKind,
            chairmanUserId: from.chairmanUserId,
            createdByUserId: userId,
          }),
        );
      } else {
        to.chairmanUserId = from.chairmanUserId;
        await this.commissionRepo.save(to);
      }
      await this.commMemberRepo.delete({ commissionId: to.id });
      if (srcMembers.length) {
        await this.commMemberRepo.save(
          srcMembers.map((m) =>
            this.commMemberRepo.create({
              commissionId: to.id,
              userId: m.userId,
              title: m.title,
              dutyLabel: m.dutyLabel,
            }),
          ),
        );
      }
    }
    return { ok: true };
  }

  async getAcceptanceCommission(schoolId: string, dtFileId: string, kind?: string) {
    const k = kind?.trim() || 'muayene_kabul';
    const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId, kind: k } });
    if (!comm) return { commission: null, members: [] };
    const members = await this.commMemberRepo.find({ where: { commissionId: comm.id } });
    return { commission: comm, members };
  }

  async createAcceptanceCommission(schoolId: string, userId: string, dto: CreateDtAcceptanceCommissionDto) {
    const file = await this.fileRepo.findOne({ where: { id: dto.dt_file_id, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const kind =
      dto.kind && (DT_COMMISSION_KINDS as readonly string[]).includes(dto.kind) ? dto.kind : 'muayene_kabul';

    const existing = await this.commissionRepo.findOne({ where: { schoolId, dtFileId: dto.dt_file_id, kind } });
    if (existing) {
      if (dto.chairman_user_id !== undefined) existing.chairmanUserId = dto.chairman_user_id || null;
      await this.commissionRepo.save(existing);
      return existing;
    }

    const comm = this.commissionRepo.create({
      schoolId,
      dtFileId: dto.dt_file_id,
      kind,
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
          dutyLabel: m.duty_label?.trim() || null,
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
      dutyLabel: dto.duty_label?.trim() || null,
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

