import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import archiver = require('archiver');
import * as XLSX from 'xlsx';
import PDFDocument = require('pdfkit');
import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Document as DocxDocument,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextDirection,
  TextRun,
  UnderlineType,
  VerticalAlign,
  VerticalMergeType,
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
  PatchDtVendorDto,
  DtRegistryReportDto,
  GenerateDtDocDto,
  BulkDtDocsArchiveDto,
  DT_BULK_ARCHIVE_DOC_TYPES,
  ListDtBudgetAccountsDto,
  ListDtFilesDto,
  ListDtVendorsDto,
  PatchDtFileDto,
  PatchDtBudgetAccountDto,
  PatchDtItemDto,
  UpsertDtAwardItemDto,
  UpsertDtQuoteItemDto,
  RecordDtPaymentDto,
  CreateDtMaterialCategoryDto,
  CreateDtMaterialLibraryItemDto,
  PatchDtMaterialLibraryItemDto,
  ListDtMaterialLibraryDto,
  CreateDtAcceptanceCommissionDto,
  AddDtCommissionMemberDto,
  PatchDtSchoolProcurementSettingsDto,
  PutDtDocumentRegistryDto,
  SyncDtCommissionDto,
  PutDtTeknikSartnameDraftDto,
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
import { UserRole, UserStatus } from '../types/enums';
import { DT_COMMISSION_KINDS, DT_REGISTRY_STAGES } from './dt-workflow.constants';
import { normalizeDtTeknikSartnameDraft } from './dt-teknik-sartname-draft';

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
      teknikSartnameJson: src.teknikSartnameJson ?? null,
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
      qty: this.parseQtyStored(dto.qty ?? '1', '1'),
      unit: dto.unit?.trim() || null,
      vatRate: typeof dto.vat_rate === 'number' ? dto.vat_rate : 20,
      estimatedUnitPrice: this.parseAmountOrNull(dto.estimated_unit_price as unknown),
      estimatedTotal: null,
    });
    void userId;
    const saved = await this.itemRepo.save(item);
    await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return {
      ...saved,
      qty: this.formatQtyOrAmountStringForApi(saved.qty) ?? saved.qty,
      estimatedUnitPrice: this.formatQtyOrAmountStringForApi(saved.estimatedUnitPrice),
      estimatedTotal: this.formatQtyOrAmountStringForApi(saved.estimatedTotal),
    };
  }

  async listItems(schoolId: string, dtFileId: string) {
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    return {
      items: items.map((it) => ({
        ...it,
        qty: this.formatQtyOrAmountStringForApi(it.qty) ?? it.qty,
        estimatedUnitPrice: this.formatQtyOrAmountStringForApi(it.estimatedUnitPrice),
        estimatedTotal: this.formatQtyOrAmountStringForApi(it.estimatedTotal),
      })),
    };
  }

  async getTeknikSartnameDraft(schoolId: string, id: string) {
    const file = await this.fileRepo.findOne({ where: { id, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['name'] });
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId: id }, order: { createdAt: 'ASC' } });
    const draft = normalizeDtTeknikSartnameDraft(file.teknikSartnameJson as unknown, {
      schoolName: school?.name ?? '',
      subject: file.subject,
      items: items.map((it) => ({ name: it.name, spec: it.spec })),
    });
    return { draft };
  }

  async putTeknikSartnameDraft(schoolId: string, userId: string, id: string, dto: PutDtTeknikSartnameDraftDto) {
    const file = await this.fileRepo.findOne({ where: { id, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['name'] });
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId: id }, order: { createdAt: 'ASC' } });
    const draft = normalizeDtTeknikSartnameDraft(dto.draft, {
      schoolName: school?.name ?? '',
      subject: file.subject,
      items: items.map((it) => ({ name: it.name, spec: it.spec })),
    });
    file.teknikSartnameJson = draft;
    file.updatedByUserId = userId;
    await this.fileRepo.save(file);
    return { draft };
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

  async deleteFile(schoolId: string, userId: string, id: string) {
    void userId;
    const row = await this.fileRepo.findOne({ where: { id, schoolId }, select: ['id'] });
    if (!row) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    await this.fileRepo.remove(row);
    return { success: true };
  }

  async patchItem(schoolId: string, userId: string, id: string, dto: PatchDtItemDto) {
    const row = await this.itemRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_ITEM_NOT_FOUND' });
    if (dto.name !== undefined) {
      const n = dto.name.trim();
      if (!n) throw new BadRequestException({ code: 'DT_ITEM_NAME_EMPTY' });
      row.name = n;
    }
    if (dto.spec !== undefined) row.spec = dto.spec?.trim() || null;
    if (dto.qty !== undefined) row.qty = this.parseQtyStored(dto.qty, row.qty || '1');
    if (dto.unit !== undefined) row.unit = dto.unit?.trim() || null;
    if (dto.vat_rate !== undefined) row.vatRate = dto.vat_rate;
    if (dto.estimated_unit_price !== undefined) {
      row.estimatedUnitPrice = this.parseAmountOrNull(dto.estimated_unit_price as unknown);
    }
    void userId;
    const saved = await this.itemRepo.save(row);
    await this.recalcFileTotalsBestEffort(schoolId, row.dtFileId);
    return {
      ...saved,
      qty: this.formatQtyOrAmountStringForApi(saved.qty) ?? saved.qty,
      estimatedUnitPrice: this.formatQtyOrAmountStringForApi(saved.estimatedUnitPrice),
      estimatedTotal: this.formatQtyOrAmountStringForApi(saved.estimatedTotal),
    };
  }

  async deleteItem(schoolId: string, userId: string, id: string) {
    void userId;
    const row = await this.itemRepo.findOne({ where: { id, schoolId }, select: ['id', 'dtFileId'] });
    if (!row) throw new NotFoundException({ code: 'DT_ITEM_NOT_FOUND' });
    const qi = await this.quoteItemRepo.count({ where: { schoolId, dtItemId: id } });
    const aw = await this.awardRepo.count({ where: { schoolId, dtItemId: id } });
    if (qi > 0 || aw > 0) {
      throw new BadRequestException({
        code: 'DT_ITEM_IN_USE',
        message: 'Bu kalem için teklif satırı veya karar kaydı var; silinemez.',
      });
    }
    await this.itemRepo.delete({ id, schoolId });
    await this.recalcFileTotalsBestEffort(schoolId, row.dtFileId);
    return { ok: true };
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

  async patchVendor(schoolId: string, userId: string, id: string, dto: PatchDtVendorDto) {
    const row = await this.vendorRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
    if (dto.title !== undefined) {
      const t = dto.title.trim();
      if (!t) throw new BadRequestException({ code: 'DT_VENDOR_TITLE_EMPTY' });
      row.title = t;
    }
    if (dto.tax_no !== undefined) row.taxNo = dto.tax_no?.trim() || null;
    if (dto.contact_name !== undefined) row.contactName = dto.contact_name?.trim() || null;
    if (dto.phone !== undefined) row.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) row.email = dto.email?.trim() || null;
    if (dto.address !== undefined) row.address = dto.address?.trim() || null;
    row.updatedByUserId = userId;
    return this.vendorRepo.save(row);
  }

  async deleteVendor(schoolId: string, userId: string, id: string) {
    void userId;
    const row = await this.vendorRepo.findOne({ where: { id, schoolId }, select: ['id'] });
    if (!row) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
    const qCount = await this.quoteRepo.count({ where: { schoolId, vendorId: id } });
    const aCount = await this.awardRepo.count({ where: { schoolId, vendorId: id } });
    if (qCount > 0 || aCount > 0) {
      throw new BadRequestException({
        code: 'DT_VENDOR_IN_USE',
        message: 'Bu firma bir veya daha fazla dosyada teklif veya karar kaydında kullanılıyor; silinemez.',
      });
    }
    await this.vendorRepo.delete({ id, schoolId });
    return { ok: true };
  }

  async createQuote(schoolId: string, userId: string, dtFileId: string, dto: CreateDtQuoteDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendor_id, schoolId }, select: ['id'] });
    if (!vendor) throw new NotFoundException({ code: 'DT_VENDOR_NOT_FOUND' });
    const purpose = dto.purpose === 'market_research' ? 'market_research' : 'bid';
    const dup = await this.quoteRepo.findOne({
      where: { schoolId, dtFileId, vendorId: vendor.id, purpose },
      select: ['id'],
    });
    if (dup) {
      throw new BadRequestException({
        code: 'DT_QUOTE_DUPLICATE',
        message:
          purpose === 'market_research'
            ? 'Bu firma için bu dosyada zaten bir fiyat araştırması kaydı var.'
            : 'Bu firma için bu dosyada zaten bir teklif / ihale kaydı var.',
      });
    }
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

  async patchQuote(schoolId: string, dtFileId: string, quoteId: string, dto: any) {
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId, schoolId, dtFileId }, select: ['id', 'status'] });
    if (!quote) throw new NotFoundException({ code: 'DT_QUOTE_NOT_FOUND' });
    if (dto.status !== undefined) {
      const validStatuses = ['requested', 'received', 'accepted', 'rejected'];
      if (!validStatuses.includes(dto.status)) {
        throw new BadRequestException({ code: 'INVALID_STATUS' });
      }
      quote.status = dto.status;
    }
    return this.quoteRepo.save(quote);
  }

  async deleteQuote(schoolId: string, userId: string, dtFileId: string, quoteId: string) {
    void userId;
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId, schoolId, dtFileId }, select: ['id'] });
    if (!quote) throw new NotFoundException({ code: 'DT_QUOTE_NOT_FOUND' });
    await this.quoteItemRepo.delete({ schoolId, quoteId });
    await this.paymentRepo
      .createQueryBuilder()
      .update(DtPayment)
      .set({ quoteId: null })
      .where('school_id = :sid', { sid: schoolId })
      .andWhere('quote_id = :qid', { qid: quoteId })
      .execute();
    await this.quoteRepo.delete({ id: quoteId, schoolId, dtFileId });
    await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return { success: true };
  }

  async deleteQuotesBulk(schoolId: string, userId: string, dtFileId: string, quoteIds: string[]) {
    void userId;
    const ids = [...new Set(quoteIds.map((x) => String(x).trim()).filter(Boolean))];
    if (!ids.length) throw new BadRequestException({ code: 'DT_QUOTE_IDS_EMPTY' });
    if (ids.length > 100) throw new BadRequestException({ code: 'DT_QUOTE_IDS_TOO_MANY' });
    const rows = await this.quoteRepo.find({ where: { schoolId, dtFileId, id: In(ids) }, select: ['id'] });
    if (rows.length !== ids.length) {
      throw new BadRequestException({
        code: 'DT_QUOTE_BULK_INVALID',
        message: 'Seçilen kayıtların tamamı bu dosyaya ait olmalıdır.',
      });
    }
    await this.quoteItemRepo.delete({ schoolId, quoteId: In(ids) });
    await this.paymentRepo
      .createQueryBuilder()
      .update(DtPayment)
      .set({ quoteId: null })
      .where('school_id = :sid', { sid: schoolId })
      .andWhere('quote_id IN (:...ids)', { ids })
      .execute();
    await this.quoteRepo.delete({ schoolId, dtFileId, id: In(ids) });
    await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return { deleted: ids.length };
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
    return {
      items: items.map((it) => ({
        ...it,
        unitPrice: this.formatQtyOrAmountStringForApi(it.unitPrice) ?? it.unitPrice,
        total: this.formatQtyOrAmountStringForApi(it.total),
      })),
    };
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
      unitPrice: this.formatQtyOrAmountNumberForApi(this.parseAmountRequired(dto.unit_price, 'DT_QUOTE_ITEM_UNIT_PRICE')),
      total: null,
    });
    const saved = await this.quoteItemRepo.save(row);
    await this.recalcFileTotalsBestEffort(schoolId, quote.dtFileId);
    return {
      ...saved,
      unitPrice: this.formatQtyOrAmountStringForApi(saved.unitPrice) ?? saved.unitPrice,
      total: this.formatQtyOrAmountStringForApi(saved.total),
    };
  }

  async listBudgetAccounts(schoolId: string, q: ListDtBudgetAccountsDto) {
    const where: Record<string, unknown> = { schoolId };
    if (q.year) where.year = q.year;
    const items = await this.budgetRepo.find({
      where,
      order: { year: 'DESC', code: 'ASC', label: 'ASC' } as any,
      take: 2000,
    });
    return { items };
  }

  async createBudgetAccount(schoolId: string, userId: string, dto: CreateDtBudgetAccountDto) {
    const parentId = dto.parent_id?.trim() || null;
    if (parentId) {
      const parent = await this.budgetRepo.findOne({ where: { id: parentId, schoolId } });
      if (!parent || parent.year !== dto.year) {
        throw new BadRequestException({
          code: 'DT_BUDGET_PARENT_INVALID',
          message: 'Üst hesap bulunamadı veya yıl uyuşmuyor.',
        });
      }
    }
    const row = this.budgetRepo.create({
      schoolId,
      year: dto.year,
      parentId,
      code: dto.code?.trim() || null,
      label: dto.label.trim(),
      allocated:
        dto.allocated != null && String(dto.allocated).trim()
          ? (this.toNum(dto.allocated) ?? 0).toFixed(6)
          : '0',
      blocked: '0',
      spent: '0',
      createdByUserId: userId,
      updatedByUserId: userId,
    });
    return this.budgetRepo.save(row);
  }

  async patchBudgetAccount(schoolId: string, userId: string, id: string, dto: PatchDtBudgetAccountDto) {
    const acc = await this.budgetRepo.findOne({ where: { id, schoolId } });
    if (!acc) throw new NotFoundException({ code: 'DT_BUDGET_NOT_FOUND' });
    if (dto.code !== undefined) {
      const c = dto.code?.trim() || '';
      if (!c) {
        throw new BadRequestException({ code: 'DT_BUDGET_CODE_REQUIRED', message: 'Bütçe tertibi (kod) boş olamaz.' });
      }
      acc.code = c;
    }
    if (dto.label !== undefined) {
      const t = dto.label.trim();
      acc.label = t || (acc.code?.trim() ?? '') || 'Bütçe hesabı';
    }
    if (dto.allocated !== undefined && String(dto.allocated).trim()) {
      const newAlloc = this.toNum(dto.allocated) ?? 0;
      const blocked = this.toNum(acc.blocked) ?? 0;
      const spent = this.toNum(acc.spent) ?? 0;
      if (newAlloc + 1e-9 < blocked + spent) {
        throw new BadRequestException({
          code: 'DT_BUDGET_ALLOCATED_TOO_LOW',
          message: 'Alınan ödenek, bloke ve harcanan tutarların toplamından az olamaz.',
        });
      }
      acc.allocated = newAlloc.toFixed(6);
    }
    acc.updatedByUserId = userId;
    return this.budgetRepo.save(acc);
  }

  async deleteBudgetAccount(schoolId: string, _userId: string, id: string) {
    const acc = await this.budgetRepo.findOne({ where: { id, schoolId } });
    if (!acc) throw new NotFoundException({ code: 'DT_BUDGET_NOT_FOUND' });
    const childCount = await this.budgetRepo.count({ where: { schoolId, parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException({
        code: 'DT_BUDGET_HAS_CHILDREN',
        message: 'Alt hesapları olan kayıt silinemez.',
      });
    }
    const blocked = this.toNum(acc.blocked) ?? 0;
    const spent = this.toNum(acc.spent) ?? 0;
    if (blocked > 1e-9 || spent > 1e-9) {
      throw new BadRequestException({
        code: 'DT_BUDGET_IN_USE',
        message: 'Bloke veya harcama kaydı olan hesap silinemez.',
      });
    }
    const fileRef = await this.fileRepo.count({ where: { schoolId, budgetAccountId: id } as any });
    if (fileRef > 0) {
      throw new BadRequestException({
        code: 'DT_BUDGET_FILE_REF',
        message: 'Dosyalarda atanmış olan hesap silinemez.',
      });
    }
    const blockRows = await this.blockRepo.count({ where: { schoolId, budgetAccountId: id } as any });
    if (blockRows > 0) {
      throw new BadRequestException({
        code: 'DT_BUDGET_BLOCK_HISTORY',
        message: 'Blokaj geçmişi olan hesap silinemez.',
      });
    }
    await this.budgetRepo.delete({ id, schoolId });
    return { ok: true };
  }

  async blockBudget(schoolId: string, userId: string, dtFileId: string, dto: BlockDtBudgetDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const acc = await this.budgetRepo.findOne({
      where: { id: dto.budget_account_id, schoolId },
      select: ['id', 'blocked'],
    });
    if (!acc) throw new NotFoundException({ code: 'DT_BUDGET_NOT_FOUND' });
    const amt = this.parseAmountRequired(dto.amount, 'DT_BLOCK_AMOUNT');
    if (amt <= 0) throw new BadRequestException({ code: 'DT_BLOCK_AMOUNT', message: 'Tutar 0\'dan büyük olmalıdır.' });
    const amount = amt.toFixed(6);
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
    const nextBlocked = (this.toNum(acc.blocked) ?? 0) + amt;
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
    for (const b of blocks) byAcc.set(b.budgetAccountId, (byAcc.get(b.budgetAccountId) ?? 0) + (this.toNum(b.amount) ?? 0));

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
      const next = (this.toNum(acc.blocked) ?? 0) - dec;
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

    const amt = this.parseAmountRequired(dto.amount, 'DT_PAYMENT_AMOUNT');
    if (amt <= 0) throw new BadRequestException({ code: 'DT_PAYMENT_AMOUNT', message: 'Tutar 0\'dan büyük olmalıdır.' });
    if (amt <= 0) throw new BadRequestException({ code: 'DT_PAYMENT_AMOUNT' });

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
        const nextSpent = (this.toNum(acc.spent) ?? 0) + amt;
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
    const limit = Math.min(q.limit ?? 500, 10000);
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

  async patchMaterialLibraryItem(schoolId: string, id: string, dto: PatchDtMaterialLibraryItemDto) {
    const row = await this.matLibRepo.findOne({ where: { id, schoolId } });
    if (!row) throw new NotFoundException({ code: 'DT_MATERIAL_NOT_FOUND' });

    if (dto.code !== undefined) {
      const code = dto.code.trim();
      if (!code) throw new BadRequestException({ code: 'DT_MATERIAL_CODE_EMPTY' });
      if (code !== row.code) {
        const clash = await this.matLibRepo.findOne({ where: { schoolId, code }, select: ['id'] });
        if (clash) throw new BadRequestException({ code: 'DT_MATERIAL_CODE_EXISTS' });
      }
      row.code = code;
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException({ code: 'DT_MATERIAL_NAME_EMPTY' });
      row.name = name;
    }
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.unit !== undefined) row.unit = dto.unit?.trim() || null;
    if (dto.vat_rate !== undefined) row.vatRate = dto.vat_rate;

    if (dto.category_id !== undefined) {
      const cid = dto.category_id?.trim() || null;
      if (cid) {
        const cat = await this.matCatRepo.findOne({ where: { schoolId, id: cid }, select: ['id'] });
        if (!cat) throw new NotFoundException({ code: 'DT_CATEGORY_NOT_FOUND' });
        row.categoryId = cid;
      } else {
        row.categoryId = null;
      }
    }

    return this.matLibRepo.save(row);
  }

  private readHesapPlaniCatalog(): { code: string; name: string; unit: string | null; vatRate: number }[] {
    const envPath = String(process.env.DT_MATERIAL_CATALOG_XLS_PATH ?? '').trim();
    const candidates = [
      envPath || null,
      join(__dirname, 'data', 'hesap_plani1.xls'),
      join(process.cwd(), 'dist', 'dogrudan-temin', 'data', 'hesap_plani1.xls'),
      join(process.cwd(), 'src', 'dogrudan-temin', 'data', 'hesap_plani1.xls'),
      'c:\\Users\\mehme\\OneDrive\\Desktop\\hesap_plani1.xls',
    ].filter((p): p is string => !!p);

    const path = candidates.find((p) => existsSync(p));
    if (!path) {
      throw new InternalServerErrorException({
        code: 'DT_HESAP_PLANI_MISSING',
        message: 'hesap_plani1.xls bulunamadı. (DT_MATERIAL_CATALOG_XLS_PATH ile yol verin.)',
      });
    }

    const norm = (v: unknown) =>
      String(v ?? '')
        .trim()
        .toUpperCase()
        .replaceAll('İ', 'I')
        .replaceAll('İ', 'I')
        .replaceAll('Ö', 'O')
        .replaceAll('Ü', 'U')
        .replaceAll('Ş', 'S')
        .replaceAll('Ğ', 'G')
        .replaceAll('Ç', 'C')
        .replaceAll('�', '')
        .replace(/[^A-Z0-9]/g, '');

    try {
      const wb = XLSX.readFile(path, { cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0] ?? ''];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      const header = (rows[0] ?? []).map((h) => String(h ?? '').trim());
      const hNorm = header.map(norm);

      const idxCode = hNorm.findIndex((h) => h.includes('HESAPKODU') || (h.includes('HESAP') && h.includes('KOD')));
      const idxName = hNorm.findIndex((h) => h.includes('ACIKLAMA'));
      const idxUnit = hNorm.findIndex((h) => h.includes('OLCUBIRIMI') || (h.includes('OLCU') && h.includes('BIRIM')));
      const idxVat = hNorm.findIndex((h) => h.includes('KDV'));

      if (idxCode < 0 || idxName < 0) {
        throw new Error(`bad header: ${header.join(' | ')}`);
      }

      const out: Array<{ code: string; name: string; unit: string | null; vatRate: number }> = [];
      const seen = new Set<string>();

      for (const r of rows.slice(1)) {
        const code = String(r[idxCode] ?? '').trim();
        const name = String(r[idxName] ?? '').trim();
        if (!code || !name) continue;
        if (seen.has(code)) continue;
        seen.add(code);

        const unitRaw = idxUnit >= 0 ? String(r[idxUnit] ?? '').trim() : '';
        const vatRaw = idxVat >= 0 ? r[idxVat] : '';
        const vatNum = Number(String(vatRaw ?? '').trim().replace(',', '.'));
        const vatRate = Number.isFinite(vatNum) ? Math.max(0, Math.min(100, Math.round(vatNum))) : 20;

        out.push({ code, name, unit: unitRaw ? unitRaw : null, vatRate });
      }

      if (out.length === 0) throw new Error('empty');
      return out;
    } catch {
      throw new InternalServerErrorException({
        code: 'DT_HESAP_PLANI_INVALID',
        message: 'hesap_plani1.xls okunamadı.',
      });
    }
  }

  async seedOrtakKamuMaterialLibrary(schoolId: string, userId: string) {
    // Eski verileri komple temizle (CPV dahil)
    await this.matLibRepo.delete({ schoolId } as any);
    await this.matCatRepo.delete({ schoolId } as any);

    // Yeni katalog: hesap planı Excel
    const catalog = this.readHesapPlaniCatalog();
    const nameByCode = new Map(catalog.map((r) => [String(r.code).trim(), String(r.name).trim()]));
    const codes = catalog.map((r) => String(r.code).trim()).filter(Boolean);
    const codeSet = new Set(codes);

    const isParent = (c: string) => {
      const prefix = `${c}.`;
      // 12k satırda startsWith taraması pahalı; prefix setini önceden üret.
      return parentSet.has(c);
    };

    const parentSet = new Set<string>();
    for (const c of codes) {
      const parts = c.split('.');
      for (let i = 1; i < parts.length; i++) {
        parentSet.add(parts.slice(0, i).join('.'));
      }
    }

    const level = (c: string) => c.split('.').length;

    // Kategori seviyesi: sadece 1-2 seviye (çok kategori olmasın)
    const categoryCodes = new Set<string>();
    for (const c of codes) {
      if (!isParent(c)) continue;
      const lv = level(c);
      if (lv <= 2) categoryCodes.add(c);
    }

    // Kategori ağacı
    const root = await this.matCatRepo.save(
      this.matCatRepo.create({ schoolId, name: 'Hesap Planı', parentId: null }),
    );
    const catIdByCode = new Map<string, string>();
    const sortedCats = [...categoryCodes].sort((a, b) => level(a) - level(b) || a.localeCompare(b));

    for (const c of sortedCats) {
      const parts = c.split('.');
      const parentCode = parts.length > 1 ? parts.slice(0, -1).join('.') : '';
      const parentId = parentCode && categoryCodes.has(parentCode) ? catIdByCode.get(parentCode) ?? root.id : root.id;
      const label = (nameByCode.get(c) ?? c).trim();
      const cat = await this.matCatRepo.save(
        this.matCatRepo.create({
          schoolId,
          name: `${c} - ${label}`.slice(0, 256),
          parentId,
        }),
      );
      catIdByCode.set(c, cat.id);
    }

    // Malzemeler: sadece yaprak (altı olmayan) kodlar
    const leafRows = catalog.filter((r) => {
      const c = String(r.code).trim();
      return c && codeSet.has(c) && !isParent(c);
    });

    const findNearestCategoryId = (code: string): string | null => {
      const parts = code.split('.');
      for (let i = Math.min(parts.length - 1, 2); i >= 1; i--) {
        const cc = parts.slice(0, i).join('.');
        if (categoryCodes.has(cc)) return catIdByCode.get(cc) ?? null;
      }
      // tek seviye ise direkt kategori olabilir; değilse null
      return null;
    };

    const chunkSize = 400;
    let inserted = 0;
    for (let i = 0; i < leafRows.length; i += chunkSize) {
      const part = leafRows.slice(i, i + chunkSize);
      await this.matLibRepo.insert(
        part.map((r) => {
          const c = String(r.code).trim();
          return {
            schoolId,
            categoryId: findNearestCategoryId(c),
            code: c,
            name: String(r.name ?? '').trim().slice(0, 512),
            // Açıklama mantıklı değilse boş: Excel'de ekstra açıklama yok, null bırakıyoruz
            description: null,
            unit: r.unit?.trim() ? r.unit.trim().slice(0, 32) : null,
            vatRate: Number.isFinite(r.vatRate) ? r.vatRate : 20,
            createdByUserId: userId,
          };
        }),
      );
      inserted += part.length;
    }

    return {
      inserted,
      skipped_existing: catalog.length - leafRows.length,
      catalog_rows: catalog.length,
    };
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
      ? await this.quoteItemRepo.find({ where: { schoolId, quoteId: In(quoteIds) } })
      : [];

    const quoteById = new Map(quotes.map((q) => [q.id, q]));
    const prices = new Map<string, Map<string, number>>(); // vendorId -> itemId -> unitPrice
    for (const qi of quoteItems) {
      const q = quoteById.get(qi.quoteId);
      if (!q) continue;
      const v = q.vendorId;
      const up = this.toNum(qi.unitPrice);
      if (up == null || !Number.isFinite(up)) continue;
      if (!prices.has(v)) prices.set(v, new Map());
      prices.get(v)!.set(qi.dtItemId, up);
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
        unitPrice: this.formatQtyOrAmountNumberForApi(Number(c.unitPrice)),
        total: Number.isFinite(total) ? this.formatQtyOrAmountNumberForApi(total) : null,
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
    const rows = await this.docRepo.find({
      where: { schoolId, dtFileId },
      order: { createdAt: 'DESC' },
      take: 80,
    });
    const seen = new Set<string>();
    const items: Array<{ id: string; docType: string; fileFormat: string; filename: string; createdAt: Date }> = [];
    for (const x of rows) {
      const k = `${x.docType}\t${x.fileFormat}`;
      if (seen.has(k)) continue;
      seen.add(k);
      items.push({
        id: x.id,
        docType: x.docType,
        fileFormat: x.fileFormat,
        filename: x.filename,
        createdAt: x.createdAt,
      });
    }
    return { items };
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
    /** true: PDF/DOCX üretilir ama S3 ve dt_generated_docs kaydı yapılmaz (toplu ZIP için). */
    skipPersist?: boolean;
  }): Promise<{ download_url: string; filename: string; buffer?: Buffer }> {
    const { schoolId, userId, dtFileId, docType, buffer, filenameBase, filenameExtra } = input;
    const fileFormat = input.fileFormat ?? 'docx';
    const ext = fileFormat === 'pdf' ? 'pdf' : 'docx';
    const suffix = filenameExtra ? `-${filenameExtra}` : '';
    const filename =
      `${filenameBase}${suffix}`.replace(/[^\w\u00C0-\u024F\s.-]/gi, '').replace(/\s+/g, '-').slice(0, 180) + `.${ext}`;
    if (input.skipPersist) {
      return { download_url: '', filename, buffer };
    }
    const mime =
      fileFormat === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const key = `dogrudan_temin/generated/${uuidv4()}-${docType}.${ext}`;
    await this.uploadService.uploadBuffer(key, buffer, mime);
    if (!filenameExtra) {
      await this.docRepo.delete({ schoolId, dtFileId, docType, fileFormat });
    }
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
    const resolveTtf = (name: string): string | null => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require.resolve(`dejavu-fonts-ttf/ttf/${name}`);
      } catch {
        const p = join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf', name);
        return existsSync(p) ? p : null;
      }
    };
    const reg = resolveTtf('DejaVuSans.ttf');
    const bold = resolveTtf('DejaVuSans-Bold.ttf');
    if (reg && bold) {
      doc.registerFont('DT', reg);
      doc.registerFont('DTB', bold);
      doc.font('DT');
      return { regular: 'DT', bold: 'DTB' };
    }
    return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
  }

  private pdfBuffer(
    build: (doc: InstanceType<typeof PDFDocument>, fonts: { regular: string; bold: string }) => void,
    pageOpts?: { layout?: 'portrait' | 'landscape' },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      /** A4 yatay (pt); bazı pdfkit sürümlerinde `layout: landscape` tek başına MediaBox’ı çevirmeyebilir. */
      const a4Landscape: [number, number] = [841.89, 595.28];
      const doc =
        pageOpts?.layout === 'landscape'
          ? new PDFDocument({ size: a4Landscape, margin: 40 })
          : new PDFDocument({ size: 'A4', margin: 40 });
      const fonts = this.pdfRegisterFonts(doc);
      let pageNo = 1;
      const drawFooter = () => {
        const savedX = doc.x;
        const savedY = doc.y;
        const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        /** Alt kenara yakın ama sayfa dışına taşmayacak şekilde; aksi halde doc.y sayfa sonuna gidip hemen addPage ile boş 1. sayfa oluşur. */
        const y = Math.min(doc.page.height - doc.page.margins.bottom - 4, doc.page.height - 22);
        doc.save();
        doc.font(fonts.regular).fontSize(8).fillColor('#6b7280').text(`Sayfa ${pageNo}`, doc.page.margins.left, y, {
          width: w,
          align: 'right',
        });
        doc.restore();
        doc.x = savedX;
        doc.y = savedY;
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

  /** Örnek resmî şablon (ihtiyaç listesi): 4734 metni. */
  private ihtiyacListesiKanunMetniTr(): string {
    return "Müdürlüğümüzün ihtiyacı olan mal/malzeme yukarıya çıkarılmış olup 4734 Sayılı İhale Yasası'nın 22/d maddesi gereğince Doğrudan Temin yoluyla satın alınması için uygun görüldüğü takdirde OLUR'larınıza arz ederim.";
  }

  /** Tablo: Sıra No, Mal/Malzemenin Adı, Özelliği, Miktarı, Ölçeği (resmî şablon). */
  private ihtiyacListesiTableRowCells(it: DtItem, idx: number): string[] {
    const unit = (it.unit ?? '').trim();
    const qtyStr = this.formatQtyOrAmountStringForApi(it.qty) ?? String(it.qty ?? '');
    return [String(idx + 1), String(it.name ?? ''), String(it.spec ?? ''), qtyStr, unit || '—'];
  }

  /** İhtiyaç listesi: dış çerçeve ve düşey çizgiler tek çizgi; satırlar arası yatay çizgi noktalı (başlık altı düz). */
  private pdfIhtiyacListesiTable(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    columns: Array<{ header: string; width: number; align?: 'left' | 'center' | 'right' }>,
    rows: string[][],
  ) {
    const startX = doc.page.margins.left;
    let y = doc.y;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableW = pageW;
    const totalW = columns.reduce((a, c) => a + c.width, 0) || 1;
    const widths = columns.map((c) => (c.width / totalW) * tableW);
    const fontSize = 10;
    const headerFontSize = 10;
    const padY = 4;

    const rowHeightFor = (cells: string[], size: number, bold: boolean) => {
      doc.font(bold ? fonts.bold : fonts.regular).fontSize(size);
      const hs = cells.map((t, i) => {
        const w = widths[i] - 8;
        return doc.heightOfString(String(t ?? ''), { width: w });
      });
      return Math.max(18, Math.max(...hs) + padY * 2 + 2);
    };

    const allRows = [columns.map((c) => c.header), ...rows];
    const heights = allRows.map((cells, idx) =>
      rowHeightFor(cells, idx === 0 ? headerFontSize : fontSize, idx === 0),
    );

    const drawHLine = (x1: number, x2: number, yy: number, dotted: boolean) => {
      doc.save();
      if (dotted) doc.dash(3, { space: 3 });
      doc.moveTo(x1, yy).lineTo(x2, yy).stroke();
      doc.restore();
    };

    const drawVLine = (xx: number, y1: number, y2: number) => {
      doc.moveTo(xx, y1).lineTo(xx, y2).stroke();
    };

    let yCursor = y;
    for (let r = 0; r < allRows.length; r++) {
      const h = heights[r] ?? 20;
      if (yCursor + h > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        yCursor = doc.y;
      }
      const y0 = yCursor;
      const y1 = yCursor + h;
      const isHeader = r === 0;
      const isLast = r === allRows.length - 1;

      if (isHeader) {
        drawHLine(startX, startX + tableW, y0, false);
      } else if (r === 1) {
        drawHLine(startX, startX + tableW, y0, false);
      } else {
        drawHLine(startX, startX + tableW, y0, true);
      }

      drawVLine(startX, y0, y1);
      let xv = startX;
      for (let i = 0; i < widths.length; i++) {
        xv += widths[i];
        drawVLine(xv, y0, y1);
      }

      if (isLast) drawHLine(startX, startX + tableW, y1, false);
      else drawHLine(startX, startX + tableW, y1, isHeader ? false : true);

      const cells = allRows[r] ?? [];
      let x = startX;
      for (let i = 0; i < widths.length; i++) {
        const w = widths[i];
        const t = String(cells[i] ?? '');
        const align = columns[i]?.align ?? 'left';
        doc
          .font(isHeader ? fonts.bold : fonts.regular)
          .fontSize(isHeader ? headerFontSize : fontSize)
          .text(t, x + 4, y0 + padY, { width: w - 8, align });
        x += w;
      }
      yCursor = y1;
    }
    doc.x = startX;
    doc.y = yCursor + 8;
  }

  /** Yaygın resmî «DİĞER ŞARTLAR» ön doldurma (piyasa araştırması şablonu). */
  private dtFiyatArastirmaDigerSartRows(): ReadonlyArray<{ label: string; value: string }> {
    return [
      { label: 'Teslim Süresi', value: '10' },
      { label: 'Teslim Edilecek Parti Miktarı', value: '1' },
      { label: 'Nakliye ve Sigortanın Kime Ait Olduğu', value: 'Satıcıya' },
      { label: 'Diğer Özel Şartlar', value: '' },
      { label: 'Uyulması Gereken Standartlar', value: 'TSE' },
      { label: 'Teknik Şartname', value: '' },
      { label: 'Diğer Hususlar', value: '' },
    ];
  }

  /** Malzeme tablosu miktar hücresi (6.000000 gibi gereksiz sıfırları sadeleştirir). */
  private fmtFiyatTableQty(q: unknown): string {
    const s = String(q ?? '').trim();
    if (!s) return '';
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) return s;
    if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return String(n);
  }

  /** Fiyat araştırması: yaklaşık maliyet komisyonu (3 sütun, resmî şablon). */
  private pdfFiyatArastirmaKomisyonUclu(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    blocks: Array<{ name: string; title?: string; role?: string }>,
  ) {
    const left = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const cw = w / 3;
    const y0 = doc.y;
    const padded = [...blocks];
    while (padded.length < 3) padded.push({ name: '…………………', title: '', role: '' });
    const slice = padded.slice(0, 3);
    let maxBottom = y0;
    for (let i = 0; i < 3; i++) {
      const b = slice[i];
      const x = left + i * cw;
      let curY = y0;
      const roleLine = (b.role ?? '').trim() || 'Komisyon Üyesi';
      doc.font(fonts.regular).fontSize(9).text(roleLine, x, curY, { width: cw, align: 'center' });
      curY = doc.y + 2;
      const nm = this.dtCommissionSignNameUpper((b.name ?? '').trim() || '…………………');
      doc.font(fonts.bold).fontSize(10).text(nm, x, curY, { width: cw, align: 'center' });
      curY = doc.y + 2;
      const unvan = (b.title ?? '').trim();
      if (unvan) {
        doc.font(fonts.regular).fontSize(9).text(unvan, x, curY, { width: cw, align: 'center' });
        curY = doc.y + 2;
      }
      maxBottom = Math.max(maxBottom, curY);
    }
    doc.y = maxBottom + 8;
  }

  /** Fiyat araştırması: malzeme tablosu (gri başlık, son satır KDV hariç teklif). */
  private pdfFiyatArastirmaMalzemeTable(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    items: DtItem[],
  ) {
    const startX = doc.page.margins.left;
    const tableW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const fr = [0.065, 0.24, 0.24, 0.085, 0.085, 0.145, 0.14];
    const widths = fr.map((f) => f * tableW);
    const pad = 3;
    const hdrFill = '#e8e8e8';

    const hSub = 14;
    let y = doc.y;
    let x = startX;
    for (let i = 0; i < 5; i++) {
      doc.strokeColor('#000000').rect(x, y, widths[i], hSub).stroke();
      x += widths[i];
    }
    doc.strokeColor('#000000').rect(x, y, widths[5] + widths[6], hSub).stroke();
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor('#000000')
      .text('Teklif Edilen KDV Hariç', x + pad, y + 3, { width: widths[5] + widths[6] - pad * 2, align: 'right' });
    y += hSub;

    const hHdr = 20;
    x = startX;
    const labels = ['S.No', 'Malzemenin Adı', 'Özelliği', 'Miktarı', 'Ölçeği', 'Birim Fiyatı', 'Tutarı'];
    for (let i = 0; i < 7; i++) {
      doc.save();
      doc.fillColor(hdrFill).rect(x, y, widths[i], hHdr).fill();
      doc.strokeColor('#000000').rect(x, y, widths[i], hHdr).stroke();
      doc.restore();
      const align = i === 0 || i === 3 || i === 4 ? 'center' : i >= 5 ? 'right' : 'left';
      doc
        .font(fonts.bold)
        .fontSize(8.5)
        .fillColor('#000000')
        .text(labels[i], x + pad, y + 5, { width: widths[i] - pad * 2, align: align as any });
      x += widths[i];
    }
    y += hHdr;

    const rowHFor = (cells: string[]) => {
      doc.font(fonts.regular).fontSize(8);
      const hs = cells.map((t, i) => doc.heightOfString(String(t ?? ''), { width: widths[i] - pad * 2 }));
      const mx = hs.length ? Math.max(...hs) : 8;
      return Math.max(16, mx + pad * 2 + 2);
    };

    for (let r = 0; r < items.length; r++) {
      const it = items[r];
      const cells = [
        String(r + 1),
        String(it.name ?? ''),
        String(it.spec ?? ''),
        this.fmtFiyatTableQty(it.qty),
        String(it.unit ?? ''),
        '',
        '',
      ];
      const rh = rowHFor(cells);
      if (y + rh > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.y;
      }
      x = startX;
      for (let i = 0; i < 7; i++) {
        doc.strokeColor('#000000').rect(x, y, widths[i], rh).stroke();
        const align = i === 0 || i === 3 || i === 4 ? 'center' : i >= 5 ? 'right' : 'left';
        doc
          .font(fonts.regular)
          .fontSize(8)
          .fillColor('#000000')
          .text(String(cells[i] ?? ''), x + pad, y + pad, { width: widths[i] - pad * 2, align: align as any });
        x += widths[i];
      }
      y += rh;
    }

    const rhLast = 18;
    if (y + rhLast > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.y;
    }
    x = startX;
    for (let i = 0; i < 5; i++) {
      doc.strokeColor('#000000').rect(x, y, widths[i], rhLast).stroke();
      x += widths[i];
    }
    doc.strokeColor('#000000').rect(x, y, widths[5] + widths[6], rhLast).stroke();
    doc
      .font(fonts.bold)
      .fontSize(8.5)
      .text('KDV Hariç Teklif Edilen Fiyat:', x + pad, y + 4, { width: widths[5] + widths[6] - pad * 2 });

    doc.x = startX;
    doc.y = y + rhLast + 6;
  }

  /** Fiyat araştırması: sol «Diğer şartlar» (noktalı çerçeve), sağ firma imza alanı. */
  private pdfFiyatArastirmaAltBlok(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
  ) {
    const startX = doc.page.margins.left;
    const fullW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const gap = 10;
    const leftW = fullW * 0.54;
    const rightW = Math.max(170, fullW - leftW - gap);
    const rows = this.dtFiyatArastirmaDigerSartRows();
    const y0 = doc.y;
    const labelW = leftW * 0.58;
    const valW = leftW - labelW;
    const padY = 5;
    const xR = startX + leftW + gap;

    let yL = y0;
    doc.font(fonts.bold).fontSize(10).fillColor('#000000').text('DİĞER ŞARTLAR', startX, yL, { width: leftW });
    yL += 14;

    let yR = yL;
    doc.font(fonts.regular).fontSize(9).text('Tarih:', xR, yR, { width: rightW });
    yR += 12;
    for (let k = 0; k < 4; k++) {
      doc.save();
      doc.strokeColor('#000000').dash(2, { space: 2 }).moveTo(xR, yR).lineTo(xR + rightW, yR).stroke();
      doc.undash();
      doc.restore();
      yR += 13;
    }
    yR += 4;
    doc.font(fonts.regular).fontSize(8).fillColor('#000000');
    const cap = 'Adı Soyadı, Ticaret Ünvanı, İmza, Kaşe veya Açık Adres, Tel. No';
    const capH = doc.heightOfString(cap, { width: rightW });
    doc.text(cap, xR, yR, { width: rightW, align: 'left' });
    yR += Math.max(capH, 12) + 6;
    for (let k = 0; k < 4; k++) {
      doc.save();
      doc.strokeColor('#000000').dash(2, { space: 2 }).moveTo(xR, yR).lineTo(xR + rightW, yR).stroke();
      doc.undash();
      doc.restore();
      yR += 13;
    }

    for (const { label: lb, value: val } of rows) {
      doc.font(fonts.regular).fontSize(8);
      const innerLw = Math.max(40, labelW - 6);
      const innerVw = Math.max(36, valW - 8);
      const hLb = doc.heightOfString(lb, { width: innerLw });
      const hVal = val ? doc.heightOfString(val, { width: innerVw }) : 0;
      const rh = Math.max(24, hLb + padY * 2, hVal + padY * 2);

      if (yL + rh > doc.page.height - doc.page.margins.bottom - 28) {
        doc.addPage();
        yL = doc.page.margins.top;
      }

      doc.save();
      doc.fillColor('#e8e8e8').rect(startX, yL, labelW, rh).fill();
      doc.restore();
      doc.save();
      doc.strokeColor('#000000').dash(2, { space: 2 });
      doc.rect(startX, yL, labelW, rh).stroke();
      doc.rect(startX + labelW, yL, valW, rh).stroke();
      doc.undash();
      doc.restore();
      doc.fillColor('#000000').font(fonts.regular).fontSize(8).text(lb, startX + 3, yL + padY, { width: innerLw });
      if (val) doc.font(fonts.regular).fontSize(8).text(val, startX + labelW + 4, yL + padY, { width: innerVw });
      yL += rh;
    }

    doc.x = startX;
    doc.y = Math.max(yL, yR) + 10;
  }

  private pdfTable(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    columns: Array<{ header: string; width: number; align?: 'left' | 'center' | 'right' }>,
    rows: string[][],
    options?: {
      fontSize?: number;
      headerFontSize?: number;
      subHeaderRow?: string[];
      subHeaderFontSize?: number;
      rowPaddingY?: number;
      /** Yatay iç boşluk (pt); metin çerçeveye yapışmasın. */
      cellPaddingX?: number;
      /** Satır aralığı (pt); çok satırda alt çizgiye taşmayı azaltır. */
      lineGap?: number;
      tableWidth?: number;
      /** Varsayılan true; false ise sadece veri satırları çizilir (etiket tabloları için). */
      includeHeader?: boolean;
      /** Tablo hücre çerçeveleri kesik çizgi (ör. teknik şartname). */
      borderDash?: boolean;
    },
  ) {
    const startX = doc.x;
    let y = doc.y;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableW = options?.tableWidth != null ? Math.min(options.tableWidth, pageW) : pageW;
    const totalW = columns.reduce((a, c) => a + c.width, 0) || 1;
    const widths = columns.map((c) => (c.width / totalW) * tableW);
    const fontSize = options?.fontSize ?? 8;
    const headerFontSize = options?.headerFontSize ?? 8;
    const padY = options?.rowPaddingY ?? 4;
    const padX = options?.cellPaddingX ?? 5;
    const lineGapFor = (size: number) => (options?.lineGap != null ? options.lineGap : Math.max(0.6, size * 0.2));

    const rowHeightFor = (cells: string[], size: number, bold: boolean) => {
      doc.font(bold ? fonts.bold : fonts.regular).fontSize(size);
      const lg = lineGapFor(size);
      const hs = cells.map((t, i) => {
        const innerW = Math.max(6, widths[i] - padX * 2);
        return doc.heightOfString(String(t ?? ''), { width: innerW, lineGap: lg });
      });
      const textH = hs.length ? Math.max(...hs) : 0;
      const minOne = size * 1.22;
      return Math.ceil(Math.max(minOne, textH) + padY * 2 + 3);
    };

    const drawRow = (cells: string[], bold = false, size = fontSize) => {
      const lg = lineGapFor(size);
      const h = rowHeightFor(cells, size, bold);
      if (y + h > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.y;
      }
      let x = startX;
      cells.forEach((t, i) => {
        const w = widths[i];
        if (options?.borderDash) {
          doc.save();
          doc.strokeColor('#000000').dash(2, { space: 2 });
        }
        doc.rect(x, y, w, h).stroke();
        if (options?.borderDash) {
          doc.undash();
          doc.restore();
        }
        doc
          .font(bold ? fonts.bold : fonts.regular)
          .fontSize(size)
          .text(String(t ?? ''), x + padX, y + padY, {
            width: Math.max(4, w - padX * 2),
            align: columns[i]?.align ?? 'left',
            lineGap: lg,
          });
        x += w;
      });
      y += h;
    };

    const includeHeader = options?.includeHeader !== false;
    if (includeHeader) {
      drawRow(columns.map((c) => c.header), true, headerFontSize);
      const sub = options?.subHeaderRow;
      if (sub && sub.length === columns.length) {
        drawRow(sub, true, options?.subHeaderFontSize ?? Math.max(6, headerFontSize - 0.8));
      }
    }
    rows.forEach((r) => drawRow(r, false, fontSize));
    doc.y = y + 6;
  }

  /** Teslim/tesellüm tutanağı — üst bilgi + 8 sütunlu ana tablo (şablon). */
  private pdfTeslimTesellumTutanagiLayout(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    input: {
      school: Pick<School, 'name' | 'principalName'> | null;
      settings: DtSchoolProcurementSettings | null;
      awardedVendor: DtVendor | null;
    },
  ) {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const pageW = right - left;
    const schoolName = ((input.school?.name ?? '').trim() || 'Kurum').toUpperCase();
    const harcamaBirimi = `${schoolName} MÜDÜRLÜĞÜNE`;
    const muhasebe = '…………………………………………';
    const duzenleme = this.fmtTrDate(new Date()) || '…/…/…';
    const kodRaw = (input.settings?.officialCorrespondenceCode ?? '').trim();
    const kodParts = kodRaw ? kodRaw.split(/[.\s/|-]+/).filter((p) => p.length > 0) : [];
    const kod5 = [0, 1, 2, 3, 4].map((i) => (kodParts[i] ?? '').slice(0, 8));
    const hakAd = (input.awardedVendor?.title ?? '').trim() || '—';
    const tckVkn = (input.awardedVendor?.taxNo ?? '').trim() || '……………………………';

    const annexRows: Array<{ belge: string; adedi: string }> = [
      { belge: 'Ödeme Emri Belgesi', adedi: '1' },
      { belge: 'Taşınır İşlem Fişi', adedi: '1' },
      { belge: 'Fatura', adedi: '1' },
      { belge: 'Borcu Yoktur Belgesi', adedi: '1' },
      { belge: 'Muayene Kabul', adedi: '1' },
      { belge: 'Piyasa Araştırma Tutanağı', adedi: '1' },
      { belge: 'Onay Belgesi', adedi: '1' },
      { belge: 'Yaklaşık Maliyet', adedi: '1' },
    ];
    const tahakkukFirst = '…………………………';
    const yevTarihFirst = '…/…/…';
    const yevNoFirst = '…………';
    const butceCell = '………………';

    const strokeCell = (x: number, y: number, w: number, h: number) => {
      doc.rect(x, y, w, h).stroke();
    };

    const textCell = (
      x: number,
      y: number,
      w: number,
      h: number,
      text: string,
      opts?: { bold?: boolean; size?: number; align?: 'left' | 'center' | 'right' },
    ) => {
      const size = opts?.size ?? 7.5;
      const align = opts?.align ?? 'left';
      doc.font(opts?.bold ? fonts.bold : fonts.regular).fontSize(size);
      const pad = 2;
      doc.text(text, x + pad, y + pad, { width: Math.max(4, w - pad * 2), height: h - pad * 2, align, lineGap: 0.5 });
    };

    // EK-1 sağ üst
    const yTop = doc.y;
    doc.save();
    doc.font(fonts.bold).fontSize(10);
    const ek = 'EK-1';
    const ekW = doc.widthOfString(ek);
    doc.text(ek, right - ekW, yTop);
    doc.restore();

    doc.y = yTop + 14;
    doc.x = left;

    // Başlık satırı (tam genişlik)
    const titleH = 28;
    strokeCell(left, doc.y, pageW, titleH);
    doc.font(fonts.bold).fontSize(10).text(
      'ÖDEME BELGESİ VE EKİ BELGELER TESLİM/TESELLÜM TUTANAĞI',
      left,
      doc.y + 6,
      { width: pageW, align: 'center' },
    );
    doc.y += titleH + 4;

    // --- Üst bilgi (3 satır, iki sütun) ---
    const half = pageW / 2;
    const rowInfoH = 36;
    const y1 = doc.y;
    strokeCell(left, y1, half, rowInfoH);
    strokeCell(left + half, y1, half, rowInfoH);
    doc.font(fonts.bold).fontSize(7).text('Harcama Birimi Kurumsal Kod', left + 3, y1 + 3, { width: half - 6 });
    const boxTop = y1 + 14;
    const boxH = 16;
    const gap = 3;
    const innerW = half - 12;
    const boxW = (innerW - 4 * gap) / 5;
    let bx = left + 3;
    for (let i = 0; i < 5; i++) {
      strokeCell(bx, boxTop, boxW, boxH);
      textCell(bx, boxTop, boxW, boxH, kod5[i] ?? '', { size: 9, align: 'center' });
      bx += boxW + gap;
    }
    doc.font(fonts.bold).fontSize(7).text('Muhasebe Birimi', left + half + 3, y1 + 3, { width: half - 6 });
    doc.font(fonts.regular).fontSize(8).text(muhasebe, left + half + 3, y1 + 16, { width: half - 6 });

    const y2 = y1 + rowInfoH;
    strokeCell(left, y2, half, rowInfoH);
    strokeCell(left + half, y2, half, rowInfoH);
    doc.font(fonts.bold).fontSize(7).text('Harcama Birimi', left + 3, y2 + 3, { width: half - 6 });
    doc.font(fonts.regular).fontSize(7.5).text(harcamaBirimi, left + 3, y2 + 14, { width: half - 6, align: 'left' });
    doc.font(fonts.bold).fontSize(7).text('Düzenleme Tarihi', left + half + 3, y2 + 3, { width: half - 6 });
    doc.font(fonts.regular).fontSize(9).text(duzenleme, left + half + 3, y2 + 16, { width: half - 6 });

    const y3 = y2 + rowInfoH;
    strokeCell(left, y3, half, rowInfoH);
    strokeCell(left + half, y3, half, rowInfoH);
    doc.font(fonts.bold).fontSize(7).text('Form Sıra No', left + 3, y3 + 10, { width: half - 6 });
    doc.font(fonts.bold).fontSize(7).text('Torba Numarası', left + half + 3, y3 + 10, { width: half - 6 });
    doc.y = y3 + rowInfoH + 8;
    doc.x = left;

    // --- Ana tablo (birleşik başlık + alt başlıklar) ---
    const fr = [0.13, 0.11, 0.11, 0.2, 0.07, 0.16, 0.12, 0.1];
    const ws = fr.map((f) => f * pageW);
    const hG = 18;
    const hSub = 22;
    const hData = 22;
    const yT = doc.y;
    let x = left;
    const w123 = ws[0] + ws[1] + ws[2];
    const w45 = ws[3] + ws[4];
    const w67 = ws[5] + ws[6];
    strokeCell(x, yT, w123, hG);
    textCell(x, yT, w123, hG, 'Ödeme Emri Belgesi', { bold: true, size: 7.5, align: 'center' });
    x += w123;
    strokeCell(x, yT, w45, hG);
    textCell(x, yT, w45, hG, 'Eki Belge', { bold: true, size: 7.5, align: 'center' });
    x += w45;
    strokeCell(x, yT, w67, hG);
    textCell(x, yT, w67, hG, 'Hak Sahibi', { bold: true, size: 7.5, align: 'center' });
    x += w67;
    strokeCell(x, yT, ws[7], hG);
    textCell(x, yT, ws[7], hG, 'Bütçe Tutarı Gideri', { bold: true, size: 6.8, align: 'center' });

    const ySub = yT + hG;
    x = left;
    const subLabels = ['Tahakkuk İşlem No', 'Yevmiye Tarihi', 'Yevmiye No', 'Kanıtlayıcı Belge Türü', 'Adedi', 'Adı Soyadı', 'TCK/VKN', ''];
    for (let i = 0; i < 8; i++) {
      strokeCell(x, ySub, ws[i], hSub);
      if (subLabels[i]) textCell(x, ySub, ws[i], hSub, subLabels[i], { bold: true, size: 6.5, align: 'center' });
      x += ws[i];
    }

    let yD = ySub + hSub;
    annexRows.forEach((row, idx) => {
      const tah = idx === 0 ? tahakkukFirst : '';
      const yt = idx === 0 ? yevTarihFirst : '';
      const yn = idx === 0 ? yevNoFirst : '';
      const cells = [tah, yt, yn, row.belge, row.adedi, hakAd, tckVkn, butceCell];
      x = left;
      for (let i = 0; i < 8; i++) {
        strokeCell(x, yD, ws[i], hData);
        textCell(x, yD, ws[i], hData, cells[i] ?? '', { size: 7.5, align: i === 0 || i >= 3 ? 'left' : 'center' });
        x += ws[i];
      }
      yD += hData;
    });

    doc.y = yD + 6;
    doc.x = left;

    const xCount = 1;
    const yCount = annexRows.length;
    doc.font(fonts.regular).fontSize(8.5).text(
      `Yukarıda hak sahipleri ile alacak tutarları gösterilen toplam ${xCount} adet tahakkuk evrakı ve ait toplam ${yCount} adet evrakı ve ekleri teslim alınmıştır. ${duzenleme}  Teslim Saati: ………`,
      left,
      doc.y,
      { width: pageW, align: 'justify' },
    );
    doc.moveDown(1);

    const teslimEdenName = (input.settings?.realizationAuthorityName ?? '').trim() || '…………………';
    const teslimEdenTitle = (input.settings?.realizationAuthorityTitle ?? '').trim() || '…………………';
    this.pdfSignRow(doc, fonts, [
      { role: 'TESLİM EDEN', name: teslimEdenName, title: teslimEdenTitle },
      { role: 'TESLİM ALAN', name: '…………………', title: 'Adı Soyadı' },
    ]);
    const yAfter = doc.y;
    const colW = pageW / 2;
    const gapS = 10;
    doc.font(fonts.regular).fontSize(8).text('İmza', left + gapS / 2, yAfter, { width: colW - gapS, align: 'center' });
    doc.text('İmza', left + colW + gapS / 2, yAfter, { width: colW - gapS, align: 'center' });
    doc.y = yAfter + 16;

    doc.font(fonts.regular).fontSize(6.8).fillColor('#333333');
    const notes = [
      '* Merkezi Yönetim Harcama belgeleri Yönetmeliğindeki belgenin adı yazılacaktır.',
      '** Bu bölümler Muhasebe birimi tarafından muhasebeleştirme işlemi tamamlandıktan sonra doldurulacaktır.',
      '*** Bu bölüme muhasebeleştirme işlemi tamamlandıktan sonra evrakın konulduğu torba numarası yazılacaktır.',
    ];
    notes.forEach((ln) => {
      doc.text(ln, left, doc.y, { width: pageW, align: 'left' });
      doc.moveDown(0.35);
    });
    doc.fillColor('#000000');
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
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    let norm = s.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
    if (hasComma && hasDot) norm = norm.replace(/\./g, '').replace(',', '.');
    else if (hasComma) norm = norm.replace(',', '.');
    const n = Number(norm);
    return Number.isFinite(n) ? n : null;
  }

  /** PG numeric / toFixed çıktısındaki gereksiz sondaki sıfırları kaldırır (API & formlar). */
  private formatQtyOrAmountStringForApi(raw: string | null | undefined): string | null {
    if (raw == null) return null;
    const t = String(raw).trim();
    if (!t) return null;
    const n = this.toNum(t);
    if (n == null || !Number.isFinite(n)) return t;
    return this.formatQtyOrAmountNumberForApi(n);
  }

  private formatQtyOrAmountNumberForApi(n: number): string {
    if (!Number.isFinite(n)) return '0';
    if (n === 0 || Object.is(n, -0)) return '0';
    if (Number.isInteger(n)) return String(Math.trunc(n));
    return n
      .toFixed(12)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
  }

  private parseAmountRequired(raw: unknown, errCode: string): number {
    const n = this.toNum(raw);
    if (n == null || !Number.isFinite(n)) {
      throw new BadRequestException({ code: errCode, message: 'Geçersiz tutar veya sayı formatı.' });
    }
    return n;
  }

  /** Boş → null; doluysa TR/EN ondalık parse, gereksiz sondaki sıfırlar atılır. */
  private parseAmountOrNull(raw: unknown | null | undefined): string | null {
    if (raw == null) return null;
    const t = String(raw).trim();
    if (!t) return null;
    const n = this.toNum(t);
    if (n == null) throw new BadRequestException({ code: 'DT_INVALID_AMOUNT', message: 'Geçersiz tutar formatı.' });
    return this.formatQtyOrAmountNumberForApi(n);
  }

  private parseQtyStored(raw: unknown, fallback: string): string {
    const n = this.toNum(raw);
    if (n != null) return this.formatQtyOrAmountNumberForApi(n);
    const t = String(raw ?? '').trim();
    if (!t) return fallback;
    throw new BadRequestException({ code: 'DT_INVALID_QTY', message: 'Geçersiz miktar formatı.' });
  }

  /** Aynı firmadan birden fazla «araştırma» teklifi sütunların kaymasına yol açmasın; ilk kayıt kullanılır. */
  private dedupeMarketResearchQuotes(quotes: DtQuote[]): DtQuote[] {
    const seen = new Set<string>();
    const out: DtQuote[] = [];
    for (const q of quotes) {
      if (seen.has(q.vendorId)) continue;
      seen.add(q.vendorId);
      out.push(q);
    }
    return out;
  }

  /** Piyasa araştırması / yaklaşık maliyet cetveli için firma sütunları (KDV hariç birim fiyatlar). */
  private async loadMarketResearchFirmColumns(
    schoolId: string,
    dtFileId: string,
    items: DtItem[],
    vendorById: Map<string, DtVendor>,
    maxFirms: number,
  ): Promise<
    Array<{
      quote: DtQuote;
      vendor: DtVendor | null;
      title: string;
      firmLabel: string;
      byItem: Map<string, number | null>;
      total: number;
      complete: boolean;
    }>
  > {
    const research = await this.quoteRepo.find({
      where: { schoolId, dtFileId, purpose: 'market_research' },
      order: { createdAt: 'ASC' },
      take: Math.max(maxFirms * 4, 16),
    });
    const firmQuotes = this.dedupeMarketResearchQuotes(research).slice(0, maxFirms);
    return Promise.all(
      firmQuotes.map(async (q, idx) => {
        const qis = await this.quoteItemRepo.find({ where: { quoteId: q.id }, order: { createdAt: 'ASC' } });
        const byItem = new Map(qis.map((x) => [x.dtItemId, this.toNum(x.unitPrice)] as const));
        const v = vendorById.get(q.vendorId) ?? null;
        const firmLabel = `${idx + 1}. FİRMASI`;
        const title = (v?.title ?? '').trim() || firmLabel;
        let complete = true;
        let total = 0;
        for (const it of items) {
          const p = byItem.get(it.id);
          const qty = this.toNum(it.qty) ?? 0;
          if (p == null || !Number.isFinite(p)) complete = false;
          else total += p * qty;
        }
        return { quote: q, vendor: v, title, firmLabel, byItem, total, complete };
      }),
    );
  }

  private pickLowestQuoteColumn(
    cols: Array<{
      quote: DtQuote;
      vendor: DtVendor | null;
      title: string;
      firmLabel: string;
      byItem: Map<string, number | null>;
      total: number;
      complete: boolean;
    }>,
  ): (typeof cols)[0] | null {
    const complete = cols.filter((c) => c.complete && Number.isFinite(c.total));
    const pool = complete.length ? complete : cols.filter((c) => Number.isFinite(c.total));
    if (!pool.length) return null;
    return pool.reduce((a, b) => (a.total <= b.total ? a : b));
  }

  /** Önizleme + indirilecek tutanakla aynı hesap (piyasa araştırması teklifleri). */
  async getPiyasaArastirmaTutanagiPreview(schoolId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name', 'principalName'] });
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    const vendors = await this.vendorRepo.find({ where: { schoolId } });
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const registry = await this.registryMapForFile(schoolId, file.id);
    const onay = registry.get('ihale_onay');
    const maxFirms = 4;
    const cols = await this.loadMarketResearchFirmColumns(schoolId, dtFileId, items, vendorById, maxFirms);
    const lowest = this.pickLowestQuoteColumn(cols);
    const warnings: string[] = [];
    if (!cols.length) warnings.push('Bu dosya için «Araştırma» amaçlı teklif kaydı yok.');
    if (cols.some((c) => !c.complete)) warnings.push('Bazı firmalarda tüm kalemler için birim fiyat girilmemiş.');
    const selection_basis = !cols.length
      ? null
      : cols.some((c) => c.complete)
        ? lowest?.complete
          ? ('complete_lowest' as const)
          : ('partial_lowest' as const)
        : lowest
          ? ('partial_lowest' as const)
          : null;
    if (!lowest && cols.length) warnings.push('Karşılaştırma için geçerli toplam teklif hesaplanamadı.');
    return {
      file: {
        id: file.id,
        subject: file.subject,
        procurement_ref: file.procurementRef?.trim() ?? null,
        year: file.year,
        file_no: file.fileNo,
      },
      school_name: (school?.name ?? '').trim() || null,
      onay: {
        tarih: this.fmtTrDate(onay?.docDate ?? null),
        sayi: this.registrySayi(onay),
      },
      items: items.map((it) => ({
        id: it.id,
        name: it.name ?? '',
        spec: it.spec ?? '',
        qty: this.fmtFiyatTableQty(it.qty),
        unit: it.unit ?? '',
      })),
      firms: cols.map((c, i) => ({
        index: i + 1,
        quote_id: c.quote.id,
        vendor_id: c.quote.vendorId,
        firm_label: c.firmLabel,
        vendor_title: c.title,
        complete: c.complete,
        total: Number.isFinite(c.total) ? c.total : null,
        total_formatted: Number.isFinite(c.total) ? this.fmtTry(c.total) : null,
        lines: items.map((it) => {
          const qty = this.toNum(it.qty) ?? 0;
          const p = c.byItem.get(it.id);
          const line = p != null && Number.isFinite(p) ? p * qty : null;
          return {
            dt_item_id: it.id,
            unit_price: p != null && Number.isFinite(p) ? p : null,
            unit_price_formatted: p != null && Number.isFinite(p) ? this.fmtTry(p) : null,
            line_total: line,
            line_total_formatted: line != null && Number.isFinite(line) ? this.fmtTry(line) : null,
          };
        }),
      })),
      selected: lowest
        ? {
            quote_id: lowest.quote.id,
            vendor_id: lowest.quote.vendorId,
            vendor_title: lowest.title,
            address: lowest.vendor?.address?.trim() ?? '',
            total: lowest.total,
            total_formatted: this.fmtTry(lowest.total),
            complete: lowest.complete,
          }
        : null,
      selection_basis,
      warnings,
    };
  }

  /** Önizleme + PDF/DOCX ile aynı hesap (araştırma teklifleri → ortalama birim → yaklaşık toplam). */
  async getYaklasikMaliyetCetveliPreview(schoolId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name', 'principalName'] });
    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    const vendors = await this.vendorRepo.find({ where: { schoolId } });
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const registry = await this.registryMapForFile(schoolId, file.id);
    const ymReg = registry.get('yaklasik_maliyet');
    const maxFirms = 4;
    const cols = await this.loadMarketResearchFirmColumns(schoolId, dtFileId, items, vendorById, maxFirms);
    const warnings: string[] = [];
    if (!cols.length) warnings.push('Bu dosya için «Araştırma» amaçlı teklif kaydı yok.');
    if (cols.some((c) => !c.complete)) {
      warnings.push('Bazı firmalarda tüm kalemler için birim fiyat girilmemiş; kalem ortalamaları yalnızca girilen fiyatlar üzerinden hesaplanır.');
    }
    let grandApprox = 0;
    const itemsOut = items.map((it, idx) => {
      const qty = this.toNum(it.qty) ?? 0;
      const nums = cols.map((c) => c.byItem.get(it.id) ?? null).filter((p): p is number => p != null && Number.isFinite(p));
      const avgUnit = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
      const avgLine = Number.isFinite(avgUnit) ? avgUnit * qty : 0;
      grandApprox += avgLine;
      return {
        sort: idx + 1,
        id: it.id,
        name: it.name ?? '',
        spec: it.spec ?? '',
        qty: this.fmtFiyatTableQty(it.qty),
        unit: it.unit ?? '',
        avg_unit: Number.isFinite(avgUnit) ? avgUnit : null,
        avg_line: Number.isFinite(avgLine) ? avgLine : null,
        avg_unit_formatted: Number.isFinite(avgUnit) ? this.fmtTry(avgUnit) : null,
        avg_line_formatted: Number.isFinite(avgLine) ? this.fmtTry(avgLine) : null,
        firm_lines: cols.map((c) => {
          const p = c.byItem.get(it.id) ?? null;
          const line = p != null && Number.isFinite(p) ? p * qty : null;
          return {
            quote_id: c.quote.id,
            unit_price: p != null && Number.isFinite(p) ? p : null,
            unit_price_formatted: p != null && Number.isFinite(p) ? this.fmtTry(p) : null,
            line_total: line,
            line_total_formatted: line != null && Number.isFinite(line) ? this.fmtTry(line) : null,
          };
        }),
      };
    });
    return {
      file: {
        id: file.id,
        subject: file.subject,
        procurement_ref: file.procurementRef?.trim() ?? null,
        year: file.year,
        file_no: file.fileNo,
      },
      school_name: (school?.name ?? '').trim() || null,
      düzenleme_tarih: this.fmtTrDate(ymReg?.docDate ?? null) || this.fmtTrDate(new Date()),
      hesaplama_yöntemi:
        'Her kalem için «Araştırma» tekliflerindeki KDV hariç birim fiyatların aritmetik ortalaması alınır; kalem toplamı = miktar × bu ortalama. Genel yaklaşık maliyet, kalem toplamlarının toplamıdır.',
      firms: cols.map((c, i) => ({
        index: i + 1,
        letter: String.fromCharCode(65 + i),
        quote_id: c.quote.id,
        vendor_id: c.quote.vendorId,
        firm_label: c.firmLabel,
        vendor_title: c.title,
        complete: c.complete,
        total: Number.isFinite(c.total) ? c.total : null,
        total_formatted: Number.isFinite(c.total) ? this.fmtTry(c.total) : null,
      })),
      items: itemsOut,
      grand_approx_total: grandApprox,
      grand_approx_formatted: this.fmtTry(grandApprox),
      warnings,
    };
  }

  private fmtTry(v: unknown): string {
    const n = this.toNum(v);
    if (n == null) return '';
    return `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}₺`;
  }

  /** Tabloda KDV hariç tutar (₺ yok), 2 ondalık. */
  private fmtAmountCellTr(v: unknown): string {
    const n = this.toNum(v);
    if (n == null) return '';
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  /** İmza / komisyon hücrelerinde ad-soyadın tutarlı görünmesi (büyük harf). */
  private dtCommissionSignNameUpper(name: string): string {
    const t = String(name ?? '').trim();
    if (!t) return '…………………';
    if (t === '…………………') return t;
    return t.toLocaleUpperCase('tr-TR');
  }

  /** Tablo üstünde «A FİRMASI» ile aynı tekrarlayan ünvan satırını boş bırakmak için. */
  private dtFirmTableSubtitle(letter: string, title: string): string {
    const t = (title ?? '').trim();
    if (!t) return '';
    const esc = letter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rest = t.replace(new RegExp(`^\\s*${esc}\\.?\\s*FİRMASI\\s*`, 'i'), '').trim();
    return rest;
  }

  private pdfLabeledRowsBox(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    rows: Array<{ label: string; value: string }>,
  ) {
    const x = doc.page.margins.left;
    const tw = doc.page.width - x - doc.page.margins.right;
    const y0 = doc.y;
    const pad = 10;
    let y = y0 + pad;
    for (const r of rows) {
      const yLine = y;
      doc.font(fonts.bold).fontSize(10).text(`${r.label}:`, x + pad, yLine, { width: tw * 0.34, align: 'left' });
      doc.font(fonts.regular).fontSize(10).text(r.value || '—', x + pad + tw * 0.34, yLine, { width: tw * 0.64 - pad, align: 'left' });
      y = Math.max(doc.y, yLine + 16);
    }
    const h = Math.max(y - y0 + pad, rows.length * 17 + pad * 2);
    doc.rect(x, y0, tw, h).stroke();
    doc.y = y0 + h + 10;
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
      /** TEKLİF MEKTUBU vb. resmî başlıkta alt çizgi */
      titleUnderline?: boolean;
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
    doc.moveDown(0.55);

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
      doc.font(fonts.bold).fontSize(13).fillColor('#000000');
      doc.text(title.trim(), { align: 'center', underline: input.titleUnderline === true });
      doc.moveDown(stage === 'ihtiyac_listesi' ? 1.15 : 1.05);
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

  private pdfSignatureRight(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    block: { name: string; title?: string },
  ) {
    const left = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = left + w * 0.42;
    const colW = w * 0.58;
    const y = doc.y;
    doc.font(fonts.bold).fontSize(10).text(block.name || '…………………', x, y, { width: colW, align: 'right' });
    if (block.title?.trim()) doc.font(fonts.regular).fontSize(9).text(block.title.trim(), x, y + 14, { width: colW, align: 'right' });
    doc.y = y + (block.title?.trim() ? 38 : 24);
  }

  private pdfSignRow(
    doc: InstanceType<typeof PDFDocument>,
    fonts: { regular: string; bold: string },
    blocks: Array<{ name: string; title?: string; role?: string }>,
    opts?: { boxed?: boolean; hideRole?: boolean; commissionUpperName?: boolean },
  ) {
    const left = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colW = w / Math.max(1, blocks.length);
    const y = doc.y;
    const gap = 10;
    const innerW = colW - gap;
    const x0 = (i: number) => left + i * colW + gap / 2;
    const boxH = opts?.boxed ? 96 : 50;
    const gapAfter = opts?.boxed ? 14 : 8;
    let maxBottom = y;
    blocks.forEach((b, i) => {
      const x = x0(i);
      if (opts?.boxed) doc.rect(x, y, innerW, boxH).stroke();
      let ty = y + (opts?.boxed ? 8 : 0);
      if (b.role && !opts?.hideRole) {
        doc.font(fonts.regular).fontSize(9).text(b.role, x, ty, { width: innerW, align: 'center' });
        ty = doc.y + 3;
      }
      const nmRaw = (b.name ?? '').trim() || '…………………';
      const nm = opts?.commissionUpperName ? this.dtCommissionSignNameUpper(nmRaw) : nmRaw;
      doc.font(fonts.bold).fontSize(10).text(nm, x, ty, { width: innerW, align: 'center' });
      ty = doc.y + 3;
      if (b.title?.trim()) {
        doc.font(fonts.regular).fontSize(9).text(b.title.trim(), x, ty, { width: innerW, align: 'center' });
      }
      maxBottom = Math.max(maxBottom, doc.y);
    });
    doc.y = Math.max(y + boxH, maxBottom) + gapAfter;
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
    const prof = await this.loadUserCommissionProfile(ids);

    const out: Array<{ name: string; title?: string; role?: string }> = [];
    if (comm.chairmanUserId) {
      const p = prof.get(comm.chairmanUserId);
      out.push({
        role: 'Başkan',
        name: p?.display ?? comm.chairmanUserId,
        title: p?.unvan ?? 'Komisyon Başkanı',
      });
    }
    for (const m of members) {
      const p = prof.get(m.userId);
      out.push({
        role: (m.dutyLabel ?? m.title ?? 'Üye') as string,
        name: p?.display ?? m.userId,
        title: p?.unvan,
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
    const pushC = (text: string, bold = false, size = 20) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold, size, font: 'Times New Roman' })],
      });
    const out: Paragraph[] = [];
    out.push(pushC('T.C.', true, 22));
    if (settings?.headerLine2?.trim()) out.push(pushC(settings.headerLine2.trim(), false, 18));
    if (settings?.headerLine3?.trim()) out.push(pushC(settings.headerLine3.trim(), false, 18));
    out.push(pushC((settings?.headerLine4?.trim() || school?.name || 'Kurum').trim(), false, 18));
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

  private dtDocxDefaultStyles() {
    return {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 22,
          },
        },
      },
    } as const;
  }

  /** Evrak defteri aşamasına göre Sayı / tarih, Konu ve doğrudan temin no (resmî üst bilgi). */
  private async buildDtDocxCorrespondenceHeader(
    file: DtFile,
    stage: string,
    opts?: { konuText?: string; textSizeHalfPts?: number },
  ): Promise<{ blocks: (Paragraph | Table)[]; docDateFormatted: string }> {
    const registryRows = await this.registryRepo.find({ where: { schoolId: file.schoolId, dtFileId: file.id } });
    const byStage = new Map(registryRows.map((r) => [r.stage, r] as const));
    const r = byStage.get(stage);
    const sayi = this.registrySayi(r);
    const tarih = this.fmtTrDate(r?.docDate ?? null);
    const tsz = opts?.textSizeHalfPts ?? 18;
    const none = {
      style: BorderStyle.NONE,
      size: 0,
      color: 'FFFFFF',
    };
    const cellBorders = { top: none, bottom: none, left: none, right: none } as any;
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: none,
        bottom: none,
        left: none,
        right: none,
        insideHorizontal: none,
        insideVertical: none,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorders,
              children: [
                new Paragraph({ children: [new TextRun({ text: sayi ? `Sayı: ${sayi}` : 'Sayı: …', size: tsz })] }),
              ],
            }),
            new TableCell({
              borders: cellBorders,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: tarih ? `Tarih: ${tarih}` : 'Tarih: …', size: tsz })],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        }),
      ],
    }) as any;
    const konu = (opts?.konuText ?? file.subject ?? '').trim();
    const out: (Paragraph | Table)[] = [
      table,
      new Paragraph({ children: [new TextRun({ text: `Konu: ${konu}`, size: tsz })] }),
    ];
    if (file.procurementRef?.trim()) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: `Doğrudan temin numarası: ${file.procurementRef.trim()}`, size: tsz })],
        }),
      );
    }
    out.push(new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }));
    return { blocks: out, docDateFormatted: tarih };
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

  /** Komisyon PDF/DOCX: profil evrak_defaults.ogretmen_unvani, branş, öğretmen ünvanı */
  private async loadUserCommissionProfile(ids: string[]): Promise<Map<string, { display: string; unvan?: string }>> {
    const uniq = [...new Set(ids.filter(Boolean))];
    if (!uniq.length) return new Map();
    const users = await this.userRepo.find({
      where: { id: In(uniq) },
      select: ['id', 'display_name', 'email', 'teacherBranch', 'teacherTitle', 'evrakDefaults'] as any,
    });
    return new Map(
      users.map((u: any) => {
        const display = (u.display_name as string | null)?.trim() || u.email || u.id;
        const ev = u.evrakDefaults as { ogretmen_unvani?: string } | null;
        const unvanRaw = (ev?.ogretmen_unvani ?? u.teacherBranch ?? u.teacherTitle ?? '').toString().trim();
        return [u.id, { display, unvan: unvanRaw || undefined }];
      }),
    );
  }

  async generateDocForFile(
    schoolId: string,
    userId: string,
    dtFileId: string,
    dto: GenerateDtDocDto,
    opts?: { skipPersist?: boolean },
  ) {
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
          const tnr = { regular: 'Times-Roman' as const, bold: 'Times-Bold' as const };
          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'ihtiyac_listesi',
            title: 'MAL/MALZEME İHTİYAÇ LİSTESİ',
            konu: file.subject,
            showProcurementRef: true,
            registry,
            settings,
          });
          doc.font(tnr.regular).fontSize(10);
          doc.x = doc.page.margins.left;
          this.pdfIhtiyacListesiTable(
            doc,
            tnr,
            [
              { header: 'Sıra No', width: 34, align: 'center' },
              { header: 'Mal/Malzemenin Adı', width: 168 },
              { header: 'Özelliği', width: 148 },
              { header: 'Miktarı', width: 52, align: 'center' },
              { header: 'Ölçeği', width: 50, align: 'center' },
            ],
            items.map((it, idx) => this.ihtiyacListesiTableRowCells(it, idx)),
          );
          doc.moveDown(0.45);
          const mud = `${((school?.name ?? '').trim() || 'Kurum').toUpperCase()} MÜDÜRLÜĞÜNE`;
          doc.font(tnr.bold).fontSize(11).text(mud, { align: 'center' });
          doc.moveDown(0.25);
          doc.font(tnr.regular).fontSize(10).text('(İhale/Harcama Yetkilisi)', { align: 'center' });
          doc.moveDown(0.45);
          doc.font(tnr.regular).fontSize(11).text(this.ihtiyacListesiKanunMetniTr(), { align: 'justify' });
          doc.moveDown(0.55);
          this.pdfSignatureRight(doc, tnr, {
            name: (settings?.realizationAuthorityName ?? '').trim() || '…………………',
            title: (settings?.realizationAuthorityTitle ?? '').trim() || undefined,
          });
          doc.moveDown(0.35);
          doc.font(tnr.bold).fontSize(11).text('OLUR', { align: 'center' });
          const d = this.fmtTrDate(registry.get('ihtiyac_listesi')?.docDate ?? null) || this.fmtTrDate(new Date());
          if (d) doc.font(tnr.regular).fontSize(10).text(d, { align: 'center' });
          doc.moveDown(0.2);
          doc.font(tnr.bold).fontSize(10).text(settings?.spendingAuthorityName ?? (school?.principalName ?? '…………………'), {
            align: 'center',
          });
          const spTitle = (settings?.spendingAuthorityTitle ?? '').trim();
          if (spTitle) doc.font(tnr.regular).fontSize(9).text(spTitle, { align: 'center' });
          doc.font(tnr.regular).fontSize(9).text('İhale(Harcama Yetkilisi)', { align: 'center' });
        });
        return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'ihtiyac_listesi', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'fiyat_arastirmasi') {
        const vendorId = String(dto.vendor_id ?? '').trim();
        const vendor =
          vendorId && vendorById.get(vendorId)
            ? (vendorById.get(vendorId) as DtVendor)
            : ({
                title: '…………………',
                address: '',
                taxNo: '',
                phone: '',
                email: '',
              } as any);
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
          doc.font(fonts.bold).fontSize(11).text('İLGİLİ KİŞİ/FİRMA', { align: 'center' });
          doc.moveDown(0.15);
          doc.font(fonts.bold).fontSize(10).text(vendor.title, { align: 'center' });
          if (vendor.address?.trim()) {
            doc.moveDown(0.1);
            doc.font(fonts.regular).fontSize(9).text(vendor.address.trim(), { align: 'center' });
          }
          doc.moveDown(0.45);
          doc.font(fonts.regular).fontSize(10).text(
            `${file.subject} işine ait aşağıda cinsi, özellikleri ve miktarları yazılı mallar / hizmetler 4734 sayılı Kamu İhale Kanunu'nun 22/d Maddesi gereğince Doğrudan Temin Usulüyle satın alınacağından yaklaşık maliyetin tespiti için piyasa araştırması yapılmaktadır, birim fiyatının ve tutarının KDV hariç bildirmenizi rica ederim/ederiz.`,
            { align: 'justify' },
          );
          doc.moveDown(0.55);
          const blocks = signs.length
            ? signs.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
            : [
                { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                { role: 'Komisyon Üyesi', name: '…………………', title: '' },
              ];
          this.pdfFiyatArastirmaKomisyonUclu(doc, fonts, blocks);
          doc.moveDown(0.35);
          doc.font(fonts.bold).fontSize(11).text('SATIN ALINACAK MAL/MALZEME LİSTESİ', { align: 'center' });
          doc.moveDown(0.25);
          doc.x = doc.page.margins.left;
          this.pdfFiyatArastirmaMalzemeTable(doc, fonts, items);
          doc.moveDown(0.35);
          doc.font(fonts.regular).fontSize(10).text(
            'Yukarıda ismi belirtilen mal/malzemenin birim ve toplam fiyatı günün şartlarına göre belirlenmiş olup belirtilen fiyatlar üzerinden vermeyi teklif ediyorum. Arz olunur.',
            { align: 'center' },
          );
          doc.moveDown(0.5);
          this.pdfFiyatArastirmaAltBlok(doc, fonts);
        });
        return this.persistDtGeneratedDocx({
          skipPersist: opts?.skipPersist,
          schoolId,
          userId,
          dtFileId,
          docType: 'fiyat_arastirmasi',
          buffer,
          filenameBase,
          ...(vendorId ? { filenameExtra: vendor.title } : {}),
          fileFormat: 'pdf',
        });
      }

      if (dto.doc_type === 'teklif_isteme') {
        const vendorId = String(dto.vendor_id ?? '').trim();
        const vendor =
          vendorId && vendorById.get(vendorId)
            ? (vendorById.get(vendorId) as DtVendor)
            : ({
                title: '…………………',
                address: '',
                taxNo: '',
                phone: '',
                email: '',
              } as any);
        const introTeklif =
          `İdaremiz tarafından ${file.subject} işine ait aşağıda cinsi, özellikleri ve miktarları yazılı mallar / hizmetler 4734 sayılı Kamu İhale Kanunu'nun 22/d maddesi gereğince doğrudan temin usulüyle satın alınacaktır. İlgilenmeniz halinde; teklifin KDV hariç sunulması, teklif edilen toplam bedelin rakam ve yazıyla birbirine uygun yazılması, üzerinde kazıntı, silinti ve düzeltme bulunmaması, teklif mektubunun adı soyadı ve ticaret ünvanı yazılmak suretiyle kaşelenmesi ve imzalanması zorunludur; bu şartları taşımayan teklifler değerlendirmeye alınmayacaktır.`;
        const taahhutTeklif =
          `Yukarıda belirtilen ve İdarenizce satın alınacak olan malların / hizmetlerin cinsi, özellikleri, miktarı ve diğer şartlarını okudum. KDV hariç teklif edilen toplam bedel (para birimi belirtilerek rakam ve yazı ile yazılacaktır) ……………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………… bedelle vermeyi kabul ve taahhüt ediyorum / ediyoruz.`;
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'teklif_mektubu',
            title: 'TEKLİF MEKTUBU',
            titleUnderline: true,
            konu: file.subject,
            showProcurementRef: true,
            registry,
            settings,
          });
          doc.font(fonts.regular).fontSize(10).fillColor('#000000').text(introTeklif, { align: 'justify' });
          doc.moveDown(0.65);
          doc.font(fonts.bold).fontSize(10).text('Teklif Sahibinin');
          doc.font(fonts.regular).fontSize(10);
          doc.text(`Adı Soyadı/Ticaret Unvanı, Uyruğu : ${vendor.title}`);
          doc.text(`Açık Tebligat Adresi : ${vendor.address ?? ''}`);
          doc.text(`Bağlı Olduğu Vergi Dairesi ve Vergi Numarası : ${vendor.taxNo ?? ''}`);
          doc.text(`Telefon ve Faks Numarası : ${vendor.phone ?? ''}`);
          doc.text(`E-Mail Adresi (varsa) : ${vendor.email ?? ''}`);
          doc.moveDown(0.55);
          doc.font(fonts.bold).fontSize(11).text('SATIN ALINACAK MAL/MALZEME LİSTESİ', { align: 'center' });
          doc.moveDown(0.25);
          doc.x = doc.page.margins.left;
          this.pdfFiyatArastirmaMalzemeTable(doc, fonts, items);
          doc.moveDown(0.5);
          doc.font(fonts.regular).fontSize(10).text(taahhutTeklif, { align: 'justify' });
          doc.moveDown(0.45);
          this.pdfFiyatArastirmaAltBlok(doc, fonts);
        });
        return this.persistDtGeneratedDocx({
          skipPersist: opts?.skipPersist,
          schoolId,
          userId,
          dtFileId,
          docType: 'teklif_isteme',
          buffer,
          filenameBase,
          ...(vendorId ? { filenameExtra: vendor.title } : {}),
          fileFormat: 'pdf',
        });
      }

      if (dto.doc_type === 'karar' || dto.doc_type === 'muayene_kabul_tutanagi') {
        const stage = dto.doc_type === 'muayene_kabul_tutanagi' ? 'muayene_kabul' : 'komisyon_onay';
        const kararNo =
          stage === 'muayene_kabul' ? String(registry.get('muayene_kabul')?.meta?.karar_no ?? '').trim() : '';
        const muayeneSigns =
          dto.doc_type === 'muayene_kabul_tutanagi'
            ? await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: 'muayene_kabul' })
            : [];
        const buffer = await this.pdfBuffer(
          (doc, fonts) => {
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
            doc.moveDown(0.35);
            doc.font(fonts.bold).fontSize(13).fillColor('#000000').text('MUAYENE VE KABUL KOMİSYONU KARARI', { align: 'center' });
            doc.moveDown(0.45);
            const kararTarih = this.fmtTrDate(registry.get('muayene_kabul')?.docDate ?? null) || this.fmtTrDate(new Date());
            const idareAd = `${((school?.name ?? '').trim() || 'Kurum').toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜ`;
            this.pdfLabeledRowsBox(doc, fonts, [
              { label: 'Karar No', value: kararNo || '—' },
              { label: 'Karar Tarihi', value: kararTarih },
              { label: 'İdarenin Adı', value: idareAd },
              { label: 'İşin Adı/Niteliği', value: file.subject },
            ]);
            doc.moveDown(0.35);
            doc.font(fonts.bold).fontSize(11).text(`${idareAd}NE`, { align: 'center' });
            doc.font(fonts.regular).fontSize(10).text(kararTarih, { align: 'center' });
            doc.moveDown(0.45);
            const pageInner = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const wf = (f: number) => Math.max(26, Math.floor(f * pageInner));
            const fmtNum = (v: unknown) => {
              const n = this.toNum(v);
              if (n == null || !Number.isFinite(n)) return '';
              return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
            };
            const rows = items.map((it, idx) => {
              const a = awardByItemId.get(it.id) ?? null;
              const qtyStr = this.fmtFiyatTableQty(it.qty);
              const mal = [it.name, it.spec].filter((x) => String(x ?? '').trim()).join('\n') || '—';
              return [
                String(idx + 1),
                mal,
                qtyStr,
                String(it.unit ?? ''),
                fmtNum(a?.unitPrice),
                fmtNum(a?.total),
                qtyStr,
                '0',
              ];
            });
            this.pdfTable(
              doc,
              fonts,
              [
                { header: 'SIRA\nNO', width: wf(0.042), align: 'center' },
                { header: 'MAL/MALZEMENİN\nADI', width: wf(0.26), align: 'center' },
                { header: 'MİKTARI', width: wf(0.068), align: 'center' },
                { header: 'ÖLÇEĞİ', width: wf(0.072), align: 'center' },
                { header: 'BİRİM\nFİYATI\n(KDV HARİÇ)', width: wf(0.1), align: 'center' },
                { header: 'TOPLAM\nFİYAT\n(KDV HARİÇ)', width: wf(0.11), align: 'center' },
                { header: 'KABUL\nEDİLEN\nMİKTAR', width: wf(0.095), align: 'center' },
                { header: 'KALAN', width: wf(0.055), align: 'center' },
              ],
              rows,
              {
                fontSize: 8,
                headerFontSize: 7.4,
                rowPaddingY: 4,
                cellPaddingX: 4,
                lineGap: 0.9,
              },
            );
            const sum = items.reduce((acc, it) => {
              const a = awardByItemId.get(it.id);
              const n = this.toNum(a?.total);
              return acc + (n ?? 0);
            }, 0);
            doc.moveDown(0.35);
            doc.font(fonts.bold).fontSize(10).text(`Toplam (KDV Hariç) ${this.fmtTry(sum)}`, { align: 'left' });
            doc.moveDown(0.45);
            doc.font(fonts.regular).fontSize(10).text(
              `İhale yetkilisince görevlendirilmemiz nedeniyle ${file.subject} işine ait yukarıda cinsi, miktarı ve tutarı belirtilen emtialar kontrolü yapılmış, alınmasında herhangi bir sakınca bulunmadığı tarafımızdan tesbit edilerek teslim alınmış ve iş bu karar tanzim ve imza edilmiştir.`,
              { align: 'justify' },
            );
            doc.moveDown(0.65);
            const blocks = muayeneSigns.length
              ? muayeneSigns.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
              : [
                  { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                  { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                  { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                ];
            for (let i = 0; i < blocks.length; i += 3) {
              this.pdfSignRow(doc, fonts, blocks.slice(i, i + 3), {
                boxed: true,
                hideRole: false,
                commissionUpperName: true,
              });
            }
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
          },
          dto.doc_type === 'muayene_kabul_tutanagi' ? { layout: 'landscape' as const } : undefined,
        );
        const docType = dto.doc_type === 'muayene_kabul_tutanagi' ? 'muayene_kabul_tutanagi' : 'karar';
        return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType, buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'komisyon_onay') {
        const kindLabel: Record<string, string> = {
          yaklasik_maliyet: 'Fiyat Araştırma ve Yaklaşık Maliyet Tesbit Komisyonu Adı, Ünvanı ve Görevleri',
          piyasa_satinalma: 'Piyasa Araştırma-Satın Alma İhale Komisyonu Adı, Ünvanı ve Görevleri',
          muayene_kabul: 'Muayene ve Teslim Alma Komisyonu Adı, Ünvanı ve Görevleri',
        };
        const commTables = await this.buildKomisyonOnayCommissionTableRows(schoolId, file.id);
        const olurDate = this.fmtTrDate(registry.get('komisyon_onay')?.docDate ?? null) || this.fmtTrDate(new Date());
        const bodyText = `${file.subject} işine ait ihtiyaç listesi onayı ekte sunulmuştur. Söz konusu mal/malzeme 4734 sayılı Kamu İhale Kanunu'nun 9. maddesi gereğince satın alınacağından; (1) Her türlü fiyat araştırmasını yapmak ve yaklaşık maliyet cetvelini hazırlayarak onaya sunmak üzere fiyat araştırma komisyonu, (2) Onay belgesinin tanziminden sonra yazılı teklif mektupları alarak değerlendirmek ve ihaleyi sonuçlandırarak onaya sunmak üzere ihale komisyonu, (3) Mal/malzeme tesliminden sonra satın alınan mal/malzemelerin özelliklerini ve sayılarını kontrol ederek teslim almak üzere muayene ve teslim alma komisyonu oluşturulması müdürlüğümüzce uygun görülmektedir. Makamınızca da uygun görüldüğü takdirde olurlarınıza arz ederim.`;
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'komisyon_onay',
            title: '',
            konu: 'Yaklaşık Maliyet, Piyasa Araştırması ve Muayene Kabul Komisyon Onayı',
            showProcurementRef: false,
            registry,
            settings,
          });
          const schoolLine = (school?.name ?? 'Kurum').trim().toLocaleUpperCase('tr-TR');
          doc.font(fonts.bold).fontSize(11).text(`${schoolLine} MÜDÜRLÜĞÜNE`, { align: 'center' });
          doc.font(fonts.regular).fontSize(10).text('(İhale/Harcama Yetkilisi)', { align: 'center' });
          doc.moveDown(0.45);
          doc.font(fonts.regular).fontSize(10).text(bodyText, { align: 'justify' });
          doc.moveDown(0.85);
          this.pdfSignatureRight(doc, fonts, {
            name: settings?.realizationAuthorityName?.trim() || '…………………',
            title: settings?.realizationAuthorityTitle?.trim() || undefined,
          });
          doc.moveDown(0.35);
          doc.font(fonts.bold).fontSize(11).text('OLUR', { align: 'center' });
          if (olurDate) doc.font(fonts.regular).fontSize(10).text(olurDate, { align: 'center' });
          doc.moveDown(0.25);
          const spendName = settings?.spendingAuthorityName?.trim() || school?.principalName?.trim() || '…………………';
          const spendTitle = settings?.spendingAuthorityTitle?.trim() || 'Müdür';
          doc.font(fonts.bold).fontSize(10).text(spendName, { align: 'center' });
          doc.font(fonts.regular).fontSize(9).text(spendTitle, { align: 'center' });
          doc.font(fonts.regular).fontSize(9).text('İhale (Harcama Yetkilisi)', { align: 'center' });
          doc.moveDown(0.55);
          for (const t of commTables) {
            doc.font(fonts.bold).fontSize(10).text(kindLabel[t.kind] ?? t.kind, { align: 'center' });
            doc.moveDown(0.15);
            if (!t.rows.length) {
              doc.font(fonts.regular).fontSize(10).text('(Henüz oluşturulmadı)', { align: 'center' });
              doc.moveDown(0.45);
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
            doc.moveDown(0.35);
          }
        });
        return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'komisyon_onay', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'onay_belgesi') {
        const m = await this.loadOnayBelgesiModel(schoolId, school, file, items, registry, settings);
        const buffer = await this.pdfBuffer((doc, fonts) => {
          const mx = doc.page.margins.left;
          const my = doc.page.margins.top;
          const mw = doc.page.width - mx - doc.page.margins.right;
          const mh = doc.page.height - my - doc.page.margins.bottom;
          doc.save();
          doc.fillColor('#e8eef5').rect(mx, my, mw, mh).fill();
          doc.fillColor('#000000');
          doc.restore();

          this.pdfAntet(doc, fonts, school, settings);
          doc.moveDown(0.25);
          doc.x = mx;
          doc.font(fonts.bold).fontSize(13).text('ONAY BELGESİ', mx, doc.y, { width: mw, align: 'center' });
          doc.moveDown(0.55);

          const twoCol = [
            { header: '', width: 230 },
            { header: '', width: 280 },
          ];
          doc.x = mx;
          this.pdfTable(doc, fonts, twoCol, [
            ['Doğrudan Temini Yapan İdarenin Adı:', m.idareninAdi],
            ['Belge Tarih ve Sayısı:', `${m.belgeTarih}     ${m.belgeSayi}`.trim()],
          ], { fontSize: 9, headerFontSize: 9, tableWidth: mw });

          doc.font(fonts.bold).fontSize(11).text(m.schoolMudUrluk, mx, doc.y, { width: mw, align: 'center' });
          doc.moveDown(0.15);
          doc.font(fonts.regular).fontSize(9).text('İhale/Harcama Yetkilisi', mx, doc.y, { width: mw, align: 'right' });
          doc.moveDown(0.4);

          doc.x = mx;
          this.pdfTable(doc, fonts, twoCol, [
            ['Doğrudan Temin Numarası', m.procurementRef],
            ['İşin Tanımı', m.isinTanimi],
            ['İşin Niteliği', m.isinNiteligi],
            ['İşin Miktarı', 'Ekli belgede gösterilmiştir.'],
          ], { fontSize: 9, tableWidth: mw });

          const finRows: string[][] = [
            ['Yaklaşık Maliyet (KDV Hariç)(₺):', m.approxText],
            ['Kullanılabilir Ödenek Tutarı (KDV Dahil)(₺):', m.kullanilabilirOdenek],
            ['Yatırım Proje Numarası (Varsa):', m.yatirimProjeNo],
            ['Bütçe Tertibi:', m.butceTertibi],
            ['Avans Verilecekse Şartları:', 'Verilmeyecektir.'],
            ["İhale Usulü:", "4734 Sayılı Kamu İhale Kanunu'nun 22/d Maddesi"],
            ['İlanın Şekli ve Adedi:', 'Yapılmayacak'],
            ['Ön Yeterlik/İhale Dokümanı Satış Bedeli:', '0'],
            ['Fiyat Farkı Ödenecekse Dayanağı BKK:', 'Ödenmeyecektir'],
            ['Sözleşme Düzenlenip Düzenlenmeyeceği:', 'Düzenlenmeyecektir'],
            ['Şartname Düzenlenip Düzenlenmeyeceği:', 'Düzenlenecektir'],
            ['Yeterlilik Kriterleri Aranıp Aranmayacağı:', 'Aranmayacaktır'],
          ];
          doc.x = mx;
          this.pdfTable(doc, fonts, twoCol, finRows, { fontSize: 8.5, tableWidth: mw });

          const longLabel =
            'Doğrudan Temin Usulü ile Mal ve Hizmet satın alınacaksa piyasa fiyat araştırması yapmak üzere görevlendirilecek kişi/kişiler';
          doc.x = mx;
          doc.font(fonts.bold).fontSize(8.5).text(longLabel, { width: mw });
          doc.moveDown(0.12);
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'Adı Soyadı', width: 210 },
              { header: 'Görevi', width: 150 },
              { header: 'Ünvanı', width: 150 },
            ],
            m.assignedRows,
            { fontSize: 8.5, headerFontSize: 8.5, tableWidth: mw },
          );

          doc.x = mx;
          doc.font(fonts.bold).fontSize(10).text('DİĞER AÇIKLAMALAR', { width: mw, align: 'center' });
          const yDig = doc.y;
          doc.rect(mx, yDig, mw, 26).stroke();
          doc.moveDown(0.5);

          doc.font(fonts.bold).fontSize(10).text('ONAY', mx, doc.y, { width: mw, align: 'center' });
          doc.moveDown(0.25);
          const d = m.belgeTarih;
          const w2 = (mw - 20) / 2;
          const xL = mx;
          const xR = mx + w2 + 20;
          let yS = doc.y;
          doc.font(fonts.regular).fontSize(8.5).text('alınması için ilgililerin görevlendirilmeleri hususunu', xL, yS, {
            width: w2,
            align: 'center',
          });
          doc.font(fonts.bold).fontSize(10).text('UYGUNDUR', xR, yS, { width: w2, align: 'center' });
          yS += 28;
          doc.font(fonts.regular).fontSize(7.5).text('İhale Yetkilisi Adı-Soyadı-Ünvanı', xR, yS, { width: w2, align: 'center' });
          yS += 16;
          doc.font(fonts.regular).fontSize(8.5).text(d, xL, yS, { width: w2, align: 'center' });
          doc.font(fonts.regular).fontSize(8.5).text(d, xR, yS, { width: w2, align: 'center' });
          yS += 22;
          doc.font(fonts.bold).fontSize(9).text(m.realizationName, xL, yS, { width: w2, align: 'center' });
          doc.font(fonts.bold).fontSize(9).text(m.spendingName, xR, yS, { width: w2, align: 'center' });
          yS += 16;
          doc.font(fonts.regular).fontSize(8).text(m.realizationTitle, xL, yS, { width: w2, align: 'center' });
          doc.font(fonts.regular).fontSize(8).text(m.spendingTitle, xR, yS, { width: w2, align: 'center' });
          doc.y = yS + 22;
          doc.x = mx;
          doc.moveDown(0.3);
          doc
            .font(fonts.regular)
            .fontSize(8)
            .text('Ek: İdare Tarafından Hazırlanan Yaklaşık Maliyet Hesap Cetveli', mx, doc.y, { width: mw });
        });
        return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'onay_belgesi', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'piyasa_arastirma_tutanagi' || dto.doc_type === 'yaklasik_maliyet_cetveli') {
        const maxFirms = 4;
        const cols = await this.loadMarketResearchFirmColumns(schoolId, file.id, items, vendorById, maxFirms);
        const stage = dto.doc_type === 'piyasa_arastirma_tutanagi' ? 'piyasa_arastirma' : 'yaklasik_maliyet';
        const commKind = dto.doc_type === 'piyasa_arastirma_tutanagi' ? 'piyasa_satinalma' : 'yaklasik_maliyet';
        const commSigns = await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: commKind });
        const lowest = this.pickLowestQuoteColumn(cols);
        const onay = registry.get('ihale_onay');
        const onayTarih = this.fmtTrDate(onay?.docDate ?? null);
        const onaySayi = this.registrySayi(onay);
        const buffer = await this.pdfBuffer(
          (doc, fonts) => {
          if (dto.doc_type === 'yaklasik_maliyet_cetveli') {
            void this.pdfOfficialTop(doc, fonts, {
              schoolId,
              school,
              file,
              stage: 'yaklasik_maliyet',
              title: 'YAKLAŞIK MALİYET CETVELİ',
              konu: file.subject,
              showProcurementRef: true,
              registry,
              settings,
            });
            doc.moveDown(0.35);
            const idare = `${((school?.name ?? '').trim() || 'Kurum').toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜ`;
            const düzen = this.fmtTrDate(registry.get('yaklasik_maliyet')?.docDate ?? null) || this.fmtTrDate(new Date());
            this.pdfLabeledRowsBox(doc, fonts, [
              { label: 'İdarenin Adı', value: idare },
              { label: 'Doğrudan Temin Numarası', value: file.procurementRef?.trim() ?? '—' },
              { label: 'İşin Konusu', value: file.subject },
              { label: 'Düzenleme Tarihi', value: düzen },
            ]);

            const pageInner = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const nF = cols.length;
            const snip = (s: string, n: number) => {
              const t = (s ?? '').trim();
              return t.length > n ? `${t.slice(0, n - 1)}…` : t;
            };
            const fmtNum = (n: number | null) =>
              n == null || !Number.isFinite(n)
                ? ''
                : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

            const baseFrac = {
              sira: 0.03,
              mal: nF <= 2 ? 0.2 : nF === 3 ? 0.17 : 0.15,
              oz: nF <= 2 ? 0.19 : nF === 3 ? 0.16 : 0.14,
              mik: 0.056,
              olcu: 0.06,
            };
            const baseSum = baseFrac.sira + baseFrac.mal + baseFrac.oz + baseFrac.mik + baseFrac.olcu;
            const rest = 1 - baseSum - 0.2;
            const firmPairFrac = nF ? Math.max(0.082, rest / Math.max(1, nF * 2)) : 0.1;
            const wf = (f: number) => Math.max(24, Math.floor(f * pageInner));

            const baseCols = [
              { header: 'Sıra\nNo', width: wf(baseFrac.sira), align: 'center' as const },
              { header: 'Malzemenin\nAdı', width: wf(baseFrac.mal) },
              { header: 'Özelliği', width: wf(baseFrac.oz) },
              { header: 'Miktar', width: wf(baseFrac.mik), align: 'right' as const },
              { header: 'Ölçü\nbirimi', width: wf(baseFrac.olcu), align: 'center' as const },
            ];
            const firmW = wf(firmPairFrac);
            const firmCols = cols.flatMap((c, i) => {
              const letter = String.fromCharCode(65 + i);
              const subRaw = this.dtFirmTableSubtitle(letter, (c.title ?? '').trim() || `Firma ${i + 1}`);
              const sub = subRaw ? snip(subRaw, 34) : '';
              return [
                { header: `${letter} FİRMASI`, width: firmW, align: 'center' as const },
                { header: sub, width: firmW, align: 'center' as const },
              ];
            });
            const approxW = wf(0.1);
            const tailCols = [
              {
                header: 'Birim\nyaklaşık\nmaliyet\n(KDV hariç)',
                width: approxW,
                align: 'right' as const,
              },
              {
                header: 'Toplam\nyaklaşık\nmaliyet\n(KDV hariç)',
                width: approxW,
                align: 'right' as const,
              },
            ];
            const tableCols = [...baseCols, ...firmCols, ...tailCols];
            const subHeaderRow = [
              '',
              '',
              '',
              '',
              '',
              ...cols.flatMap(() => ['Birim fiyatı\n(KDV hariç)', 'Toplam fiyat\n(KDV hariç)']),
              '',
              '',
            ];

            let grandApprox = 0;
            const rows = items.map((it, idx) => {
              const qty = this.toNum(it.qty) ?? 0;
              const prices = cols.map((c) => c.byItem.get(it.id) ?? null);
              const nums = prices.filter((p): p is number => p != null && Number.isFinite(p));
              const avgUnit = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
              const avgLine = Number.isFinite(avgUnit) ? avgUnit * qty : 0;
              grandApprox += avgLine;
              return [
                String(idx + 1),
                it.name ?? '',
                it.spec ?? '',
                this.fmtFiyatTableQty(it.qty),
                String(it.unit ?? ''),
                ...cols.flatMap((c) => {
                  const p = c.byItem.get(it.id) ?? null;
                  const t = p == null ? null : p * qty;
                  return [fmtNum(p), fmtNum(t)];
                }),
                Number.isFinite(avgUnit) ? fmtNum(avgUnit) : '',
                Number.isFinite(avgLine) ? fmtNum(avgLine) : '',
              ];
            });
            if (cols.length) {
              rows.push([
                'TOPLAM',
                '',
                '',
                '',
                '',
                ...cols.flatMap((c) => ['', Number.isFinite(c.total) ? this.fmtTry(c.total) : '']),
                '',
                '',
              ]);
            }
            rows.push([
              'Yaklaşık maliyet tutarı (KDV hariç)',
              '',
              '',
              '',
              '',
              ...Array(Math.max(0, cols.length * 2)).fill(''),
              '',
              this.fmtTry(grandApprox),
            ]);

            this.pdfTable(doc, fonts, tableCols, rows, {
              fontSize: 8.5,
              headerFontSize: 8,
              subHeaderRow: cols.length ? subHeaderRow : undefined,
              subHeaderFontSize: 7.5,
              rowPaddingY: 6,
              cellPaddingX: 6,
              lineGap: 0.95,
            });
            doc.moveDown(0.55);
            doc.font(fonts.regular).fontSize(9.5).text(
              `İdaremizce ihtiyaç duyulan ve satın alınması düşünülen aşağıda cinsi, özellikleri ve miktarları yazılı malların/hizmetlerin 4734 sayılı Kamu İhale Kanunu'nun 9. maddesi gereğince yaklaşık maliyetinin tespitine esas olmak üzere her türlü fiyat araştırması yapılmıştır. Araştırma sonuçları yukarıdaki tabloda gösterilmiştir. Yukarıda açıklandığı üzere yaklaşık maliyetin KDV hariç ${this.fmtTry(grandApprox)} takdir ve tespit edilerek iş bu hesap cetveli düzenlenerek imza altına alınmıştır.`,
              { align: 'justify' },
            );
            doc.moveDown(0.55);
            doc.font(fonts.bold).fontSize(10).text('YAKLAŞIK MALİYETİ YAPAN GÖREVLİ / GÖREVLİLER', { align: 'center' });
            doc.moveDown(0.35);
            const blocks = commSigns.length
              ? commSigns.map((s) => ({ ...s, role: s.role ?? 'Komisyon Üyesi' }))
              : [
                  { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                  { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                  { role: 'Komisyon Üyesi', name: '…………………', title: '' },
                ];
            for (let i = 0; i < blocks.length; i += 3) {
              this.pdfSignRow(doc, fonts, blocks.slice(i, i + 3), { boxed: true, hideRole: false });
            }
            return;
          }

          this.pdfOfficialTop(doc, fonts, {
            schoolId,
            school,
            file,
            stage: 'piyasa_arastirma',
            title: 'PİYASA FİYAT ARAŞTIRMA TUTANAĞI',
            konu: file.subject,
            showProcurementRef: true,
            registry,
            settings,
          });
          doc.moveDown(0.35);
          const idareAd = `${((school?.name ?? '').trim() || 'Kurum').toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜ`;
          const piyasaDocTarih = this.fmtTrDate(registry.get('piyasa_arastirma')?.docDate ?? null) || this.fmtTrDate(new Date());
          this.pdfLabeledRowsBox(doc, fonts, [
            { label: 'İdarenin Adı', value: idareAd },
            { label: 'Doğrudan Temin Numarası', value: file.procurementRef?.trim() ?? '—' },
            { label: 'İşin Konusu', value: file.subject },
            {
              label: 'Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi/Görevlendirme Onayı Tarih ve No.su',
              value: [onayTarih, onaySayi].filter(Boolean).join('  ') || '—',
            },
            { label: 'Tutanak Tarihi', value: piyasaDocTarih },
          ]);

          const pageInner = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const nF = cols.length;
          const snip = (s: string, n: number) => {
            const t = (s ?? '').trim();
            return t.length > n ? `${t.slice(0, n - 1)}…` : t;
          };
          const fmtNum = (n: number | null) =>
            n == null || !Number.isFinite(n)
              ? ''
              : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

          const baseFrac = {
            sira: 0.03,
            mal: nF <= 2 ? 0.2 : nF === 3 ? 0.17 : 0.15,
            oz: nF <= 2 ? 0.19 : nF === 3 ? 0.16 : 0.14,
            mik: 0.056,
            olcu: 0.06,
          };
          const baseSum = baseFrac.sira + baseFrac.mal + baseFrac.oz + baseFrac.mik + baseFrac.olcu;
          const firmPairFrac = nF ? Math.max(0.082, (1 - baseSum) / Math.max(1, nF * 2)) : 0.1;
          const wf = (f: number) => Math.max(24, Math.floor(f * pageInner));

          const baseCols = [
            { header: 'Sıra\nNo', width: wf(baseFrac.sira), align: 'center' as const },
            { header: 'Malzemenin\nAdı', width: wf(baseFrac.mal) },
            { header: 'Özelliği', width: wf(baseFrac.oz) },
            { header: 'Miktar', width: wf(baseFrac.mik), align: 'right' as const },
            { header: 'Ölçü\nbirimi', width: wf(baseFrac.olcu), align: 'center' as const },
          ];
          const firmW = wf(firmPairFrac);
          const firmCols = cols.flatMap((c, i) => {
            const letter = String.fromCharCode(65 + i);
            const subRaw = this.dtFirmTableSubtitle(letter, (c.title ?? '').trim() || `Firma ${i + 1}`);
            const sub = subRaw ? snip(subRaw, 34) : '';
            return [
              { header: `${letter} FİRMASI`, width: firmW, align: 'center' as const },
              { header: sub, width: firmW, align: 'center' as const },
            ];
          });
          const subHeaderRow = [
            '',
            '',
            '',
            '',
            '',
            ...cols.flatMap(() => ['Birim fiyatı\n(KDV hariç)', 'Toplam fiyat\n(KDV hariç)']),
          ];
          const tableCols = [...baseCols, ...firmCols];
          const rows = items.map((it, idx) => {
            const qty = this.toNum(it.qty) ?? 0;
            return [
              String(idx + 1),
              it.name ?? '',
              it.spec ?? '',
              this.fmtFiyatTableQty(it.qty),
              String(it.unit ?? ''),
              ...cols.flatMap((c) => {
                const p = c.byItem.get(it.id) ?? null;
                const t = p == null ? null : p * qty;
                return [fmtNum(p), fmtNum(t)];
              }),
            ];
          });
          if (cols.length) {
            rows.push([
              'TOPLAM TEKLİF',
              '',
              '',
              '',
              '',
              ...cols.flatMap((c) => ['', Number.isFinite(c.total) ? this.fmtTry(c.total) : '']),
            ]);
          }
          this.pdfTable(doc, fonts, tableCols, rows, {
            fontSize: 8.5,
            headerFontSize: 8,
            subHeaderRow: cols.length ? subHeaderRow : undefined,
            subHeaderFontSize: 7.5,
            rowPaddingY: 6,
            cellPaddingX: 6,
            lineGap: 0.95,
          });
          doc.moveDown(0.55);

          if (lowest) {
            doc.font(fonts.bold).fontSize(10).text(file.subject);
            doc.moveDown(0.25);
            doc.font(fonts.bold).fontSize(10).text('Tümünün Bu Kişi/Firmadan Alımı Uygun Görülmüştür');
            doc.moveDown(0.3);
            const tw = pageInner;
            const lw = Math.floor(tw * 0.24);
            doc.x = doc.page.margins.left;
            this.pdfTable(
              doc,
              fonts,
              [
                { header: ' ', width: lw, align: 'left' },
                { header: ' ', width: tw - lw, align: 'left' },
              ],
              [
                ['Adı', `${lowest.firmLabel}\n${lowest.title}`.trim()],
                ['Adresi', (lowest.vendor?.address ?? '').trim() || '—'],
                ['Teklif Ettiği Fiyat (KDV Hariç)', this.fmtTry(lowest.total)],
              ],
              { fontSize: 9.5, includeHeader: false, rowPaddingY: 5 },
            );
            doc.moveDown(0.45);
          }

          doc.font(fonts.regular).fontSize(9.5).text(
            `4734 sayılı Kamu İhale Kanunu'nun 22. maddesi uyarınca doğrudan temin usulüyle yapılacak alımlara ilişkin yapılan piyasa araştırmasında firmalarca/kişilerce teklif edilen fiyatlar değerlendirilerek yukarıda adı ve adresleri belirtilen kişi/firma/firmalardan alım yapılması uygun görülmüştür.`,
            { align: 'justify' },
          );
          doc.moveDown(0.55);
          doc.font(fonts.bold).fontSize(10).text('PİYASA FİYAT ARAŞTIRMA GÖREVLİSİ / GÖREVLİLERİ', { align: 'center' });
          doc.moveDown(0.35);
          const blocks = commSigns.length
            ? commSigns.map((s) => ({ ...s, role: s.role ?? '' }))
            : [
                { role: '', name: '…………………', title: '' },
                { role: '', name: '…………………', title: '' },
                { role: '', name: '…………………', title: '' },
              ];
          for (let i = 0; i < blocks.length; i += 3) {
            this.pdfSignRow(doc, fonts, blocks.slice(i, i + 3), { boxed: true, hideRole: true, commissionUpperName: true });
          }
        },
          dto.doc_type === 'piyasa_arastirma_tutanagi' || dto.doc_type === 'yaklasik_maliyet_cetveli'
            ? { layout: 'landscape' as const }
            : undefined,
        );
        const docType = dto.doc_type;
        return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType, buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'teknik_sartname') {
        const draft = normalizeDtTeknikSartnameDraft(file.teknikSartnameJson as unknown, {
          schoolName: (school?.name ?? '').trim(),
          subject: file.subject,
          items: items.map((it) => ({ name: it.name, spec: it.spec })),
        });
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfAntet(doc, fonts, school, settings);
          doc.font(fonts.bold).fontSize(11);
          if (draft.schoolLine.trim()) {
            doc.text(draft.schoolLine.trim(), { align: 'center' });
            doc.moveDown(0.2);
          }
          doc.font(fonts.bold).fontSize(13).text(draft.docTitle.trim() || 'TEKNİK ŞARTNAME', { align: 'center' });
          doc.moveDown(0.55);
          doc.font(fonts.bold).fontSize(10).text(draft.s1_title);
          doc.moveDown(0.15);
          doc.font(fonts.regular).fontSize(9.5).text(draft.s1_1, { align: 'justify' });
          doc.moveDown(0.45);
          doc.font(fonts.bold).fontSize(10).text(draft.s2_title);
          doc.moveDown(0.12);
          doc.font(fonts.regular).fontSize(9.5).text(draft.s2_idare, { align: 'justify' });
          doc.font(fonts.regular).fontSize(9.5).text(draft.s2_firma, { align: 'justify' });
          doc.moveDown(0.45);
          doc.font(fonts.bold).fontSize(10).text(draft.s3_title);
          doc.moveDown(0.12);
          doc.font(fonts.regular).fontSize(9.5).text(draft.s3_1, { align: 'justify' });
          doc.moveDown(0.45);
          doc.font(fonts.bold).fontSize(10).text(draft.s4_title);
          doc.moveDown(0.12);
          doc.font(fonts.regular).fontSize(9.5).text(`İşin Adı : ${draft.s4_jobName}`, { align: 'justify' });
          doc.moveDown(0.45);
          doc.font(fonts.bold).fontSize(10).text(draft.s5_title);
          doc.moveDown(0.12);
          doc.font(fonts.regular).fontSize(9).text(draft.s5_bullets.map((b) => `* ${b}`).join('\n'), { align: 'left' });
          doc.moveDown(0.45);
          doc.font(fonts.bold).fontSize(10).text(draft.tableTitle);
          doc.moveDown(0.15);
          this.pdfTable(
            doc,
            fonts,
            [
              { header: 'Sıra No', width: 50, align: 'center' },
              { header: 'Mal/Malzemenin Adı', width: 180 },
              { header: 'Teknik Özellikleri', width: 260 },
            ],
            draft.tableRows.map((r, idx) => [String(idx + 1), r.name || '—', (r.spec ?? '').trim() || '—']),
            { fontSize: 9, headerFontSize: 9, borderDash: true },
          );
          doc.moveDown(0.35);
          doc.font(fonts.bold).fontSize(10).text(draft.s6_title);
          doc.moveDown(0.12);
          doc.font(fonts.regular).fontSize(9.5).text(draft.s6_body, { align: 'justify' });
          doc.moveDown(0.45);
          doc.font(fonts.bold).fontSize(10).text(draft.s7_title);
          doc.moveDown(0.12);
          doc.font(fonts.regular).fontSize(9.5).text(draft.s7_1, { align: 'justify' });
          doc.font(fonts.regular).fontSize(9.5).text(draft.s7_2, { align: 'justify' });
          doc.font(fonts.regular).fontSize(9.5).text(draft.s7_3, { align: 'justify' });
          doc.moveDown(0.55);
          const dRaw = draft.documentDate?.trim();
          const d =
            dRaw && !Number.isNaN(new Date(dRaw).getTime()) ? this.fmtTrDate(dRaw) : this.fmtTrDate(new Date());
          doc.font(fonts.regular).fontSize(10).text(d, { align: 'right' });
          doc.moveDown(0.25);
          const principalName =
            (settings?.spendingAuthorityName ?? '').trim() || (school?.principalName ?? '').trim() || '…………………';
          const principalTitle = (settings?.spendingAuthorityTitle ?? '').trim();
          this.pdfSignRow(doc, fonts, [
            { role: draft.firmSignCaption.trim() || 'FİRMA/KAŞE', name: ' ' },
            {
              role: draft.schoolStampLine.trim() || 'İmza/Mühür',
              name: principalName,
              title: [draft.schoolTitleLine, principalTitle || undefined, draft.schoolRoleLine]
                .filter((x) => (x ?? '').toString().trim())
                .join('\n'),
            },
          ]);
        });
        return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'teknik_sartname', buffer, filenameBase, fileFormat: 'pdf' });
      }

      if (dto.doc_type === 'teslim_tesellum_tutanagi') {
        const awardedVendorId = awards[0]?.vendorId ?? '';
        const awardedVendor = awardedVendorId ? vendorById.get(awardedVendorId) ?? null : null;
        const buffer = await this.pdfBuffer((doc, fonts) => {
          this.pdfTeslimTesellumTutanagiLayout(doc, fonts, { school, settings, awardedVendor });
        });
        return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
          schoolId,
          userId,
          dtFileId,
          docType: 'teslim_tesellum_tutanagi',
          buffer,
          filenameBase,
          fileFormat: 'pdf',
        });
      }

      if (dto.doc_type === 'sozlesme' || dto.doc_type === 'harcama_talimati') {
        throw new BadRequestException({
          code: 'DT_PDF_NOT_SUPPORTED',
          message:
            dto.doc_type === 'harcama_talimati'
              ? 'Harcama talimatı yalnızca DOCX olarak üretilir; DOCX seçin.'
              : 'Sözleşme için PDF desteklenmiyor.',
        });
      }

      throw new BadRequestException({
        code: 'DT_PDF_NOT_SUPPORTED',
        message: 'Bu belge türü için PDF üretimi tanımlı değil; DOCX seçin.',
      });
    }

    if (dto.doc_type === 'ihtiyac_listesi') {
      const buffer = await this.buildIhtiyacListesiDocx({ school, file, items, letterhead });
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'ihtiyac_listesi', buffer, filenameBase, fileFormat: 'docx' });
    }

    if (dto.doc_type === 'teklif_isteme') {
      const vendorId = String(dto.vendor_id ?? '').trim();
      const vendor =
        vendorId && vendorById.get(vendorId)
          ? (vendorById.get(vendorId) as DtVendor)
          : ({
              title: '…………………',
              address: '',
              taxNo: '',
              phone: '',
              email: '',
            } as any);
      const buffer = await this.buildTeklifIstemeDocx({ school, file, items, vendor, letterhead });
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
        schoolId,
        userId,
        dtFileId,
        docType: 'teklif_isteme',
        buffer,
        filenameBase,
        ...(vendorId ? { filenameExtra: vendor.title } : {}),
        fileFormat: 'docx',
      });
    }

    if (dto.doc_type === 'teknik_sartname' || dto.doc_type === 'teslim_tesellum_tutanagi') {
      throw new BadRequestException({ code: 'DT_DOCX_NOT_SUPPORTED', message: 'Bu belge türü için DOCX desteklenmiyor.' });
    }

    if (dto.doc_type === 'fiyat_arastirmasi') {
      const vendorId = String(dto.vendor_id ?? '').trim();
      const vendor =
        vendorId && vendorById.get(vendorId)
          ? (vendorById.get(vendorId) as DtVendor)
          : ({
              title: '…………………',
              address: '',
              taxNo: '',
              phone: '',
              email: '',
            } as any);
      const signs = await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: 'yaklasik_maliyet' });
      const blocks = signs.length
        ? signs.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
        : [
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
          ];
      const buffer = await this.buildFiyatArastirmasiDocx({ file, items, vendor, letterhead, blocks });
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
        schoolId,
        userId,
        dtFileId,
        docType: 'fiyat_arastirmasi',
        buffer,
        filenameBase,
        ...(vendorId ? { filenameExtra: vendor.title } : {}),
        fileFormat: 'docx',
      });
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
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
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
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'komisyon_onay', buffer, filenameBase, fileFormat: 'docx' });
    }

    if (dto.doc_type === 'onay_belgesi') {
      const buffer = await this.buildOnayBelgesiDocx(schoolId, school, file, letterhead, items);
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'onay_belgesi', buffer, filenameBase, fileFormat: 'docx' });
    }

    if (dto.doc_type === 'piyasa_arastirma_tutanagi') {
      const cols = await this.loadMarketResearchFirmColumns(schoolId, file.id, items, vendorById, 4);
      const lowest = this.pickLowestQuoteColumn(cols);
      const commissionBlocks = await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: 'piyasa_satinalma' });
      const buffer = await this.buildPiyasaArastirmaTutanagiDocx({
        schoolId,
        school,
        letterhead,
        file,
        items,
        cols,
        lowest,
        commissionBlocks,
      });
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
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
      const cols = await this.loadMarketResearchFirmColumns(schoolId, file.id, items, vendorById, 4);
      const commissionBlocks = await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: 'yaklasik_maliyet' });
      const buffer = await this.buildYaklasikMaliyetCetveliDocx({
        schoolId,
        school,
        letterhead,
        file,
        items,
        cols,
        commissionBlocks,
      });
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
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
      const signs = await this.commissionSignatureBlocks({ schoolId, dtFileId: file.id, kind: 'muayene_kabul' });
      const commissionBlocks = signs.length
        ? signs.map((s) => ({ ...s, role: 'Komisyon Üyesi' }))
        : [
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
          ];
      const buffer = await this.buildMuayeneKabulDocx({
        schoolId,
        school,
        letterhead,
        file,
        items,
        awardByItemId,
        commissionBlocks,
      });
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
        schoolId,
        userId,
        dtFileId,
        docType: 'muayene_kabul_tutanagi',
        buffer,
        filenameBase,
        fileFormat: 'docx',
      });
    }

    if (dto.doc_type === 'harcama_talimati') {
      const buffer = await this.buildHarcamaTalimatiDocx({ school, file, items, letterhead });
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist,
        schoolId,
        userId,
        dtFileId,
        docType: 'harcama_talimati',
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
      return this.persistDtGeneratedDocx({ skipPersist: opts?.skipPersist, schoolId, userId, dtFileId, docType: 'karar', buffer, filenameBase, fileFormat: 'docx' });
    }

    throw new BadRequestException({ code: 'DT_INVALID_DOC_TYPE' });
  }

  async bulkArchiveDtDocsAsZip(
    schoolId: string,
    userId: string,
    dtFileId: string,
    dto: BulkDtDocsArchiveDto,
  ): Promise<{ download_url: string; filename: string }> {
    void userId;
    if (dto.archive_format === 'rar') {
      throw new BadRequestException({
        code: 'DT_RAR_NOT_SUPPORTED',
        message: 'RAR arşivi sunucuda üretilmiyor. ZIP ile indirin veya ZIP’i masaüstünde RAR’a dönüştürün.',
      });
    }
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    if (!dto.items?.length) throw new BadRequestException({ code: 'DT_BULK_EMPTY', message: 'En az bir belge seçin.' });

    const bulkKeys = new Set<string>([...DT_BULK_ARCHIVE_DOC_TYPES]);
    const defVendor = String(dto.default_vendor_id ?? '').trim();

    const seen = new Set<string>();
    const items = dto.items.filter((it) => {
      const k = `${it.doc_type}\t${String(it.vendor_id ?? '').trim()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    for (const it of items) {
      if (!bulkKeys.has(it.doc_type)) {
        throw new BadRequestException({
          code: 'DT_BULK_DOC_NOT_ALLOWED',
          message: `Toplu pakette desteklenmeyen belge türü: ${it.doc_type}`,
        });
      }
      void defVendor;
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    let idx = 0;
    for (const it of items) {
      idx += 1;
      const vendorId =
        it.doc_type === 'fiyat_arastirmasi' || it.doc_type === 'teklif_isteme'
          ? String(it.vendor_id ?? '').trim() || defVendor
          : undefined;
      const gen = await this.generateDocForFile(
        schoolId,
        userId,
        dtFileId,
        {
          doc_type: it.doc_type as GenerateDtDocDto['doc_type'],
          file_format: 'pdf',
          ...(vendorId ? { vendor_id: vendorId } : {}),
        },
        { skipPersist: true },
      );
      if (!gen.buffer?.length) {
        throw new InternalServerErrorException({
          code: 'DT_BULK_NO_BUFFER',
          message: `${it.doc_type} PDF üretilemedi.`,
        });
      }
      const safe = `${String(idx).padStart(2, '0')}_${gen.filename.replace(/[/\\\\?%*:|"<>]/g, '_')}`;
      archive.append(gen.buffer, { name: safe });
    }

    archive.finalize();
    
    await new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', reject);
    });

    const zipBuffer = Buffer.concat(chunks);
    const rootName = `DT-${file.year}-${file.fileNo}-belgeler.zip`
      .replace(/[^\w\u00C0-\u024F\s.-]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 120);
    const key = `dogrudan_temin/bulk/${uuidv4()}-${rootName}`;
    await this.uploadService.uploadBuffer(key, zipBuffer, 'application/zip');
    const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, rootName);
    return { download_url: downloadUrl, filename: rootName };
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

  private mysUnitCode(unit: string | null): string {
    const u = String(unit ?? '').trim().toLowerCase();
    if (!u) return 'ADET_BIRIM';
    if (u.includes('adet')) return 'ADET_BIRIM';
    if (u === 'kg' || u.includes('kilo')) return 'KG_BIRIM';
    if (u === 'lt' || u.includes('litre')) return 'LITRE_BIRIM';
    if (u === 'm' || u.includes('metre')) return 'METRE_BIRIM';
    if (u.includes('paket')) return 'PAKET_BIRIM';
    if (u.includes('kutu')) return 'KUTU_BIRIM';
    return 'ADET_BIRIM';
  }

  async mysYukleXlsx(schoolId: string, dtFileId: string): Promise<{ download_url: string; filename: string }> {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId } });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });

    const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, order: { createdAt: 'ASC' } });
    const quotes = await this.quoteRepo.find({ where: { schoolId, dtFileId }, select: ['id', 'vendorId'] as any });
    const quoteIds = quotes.map((q) => q.id);
    const quoteById = new Map(quotes.map((q) => [q.id, q]));

    const qItems = quoteIds.length ? await this.quoteItemRepo.find({ where: { schoolId, quoteId: In(quoteIds) } }) : [];
    const vendorIds = [...new Set(quotes.map((q) => q.vendorId))];
    const vendors = vendorIds.length
      ? await this.vendorRepo.find({ where: { schoolId, id: In(vendorIds) } as any, select: ['id', 'taxNo'] as any })
      : [];
    const taxByVendor = new Map(vendors.map((v) => [v.id, String(v.taxNo ?? '').trim()]));

    const offersByItem = new Map<string, Array<{ unitPrice: number; taxNo: string }>>();
    for (const qi of qItems) {
      const q = quoteById.get(qi.quoteId);
      if (!q) continue;
      const up = this.toNum((qi as any).unitPrice);
      if (up == null || !Number.isFinite(up)) continue;
      const taxNo = taxByVendor.get(q.vendorId) ?? '';
      if (!offersByItem.has(qi.dtItemId)) offersByItem.set(qi.dtItemId, []);
      offersByItem.get(qi.dtItemId)!.push({ unitPrice: up, taxNo });
    }
    for (const arr of offersByItem.values()) {
      arr.sort((a, b) => a.unitPrice - b.unitPrice);
    }

    const rows: Array<Array<string | number>> = [
      ['Ürün Adı', 'Miktar', 'Ölçü Birimi', 'Ürün No', 'Model', 'Marka', 'Birim Tutar', 'Firma VKN/TCKN'],
    ];

    for (const it of items) {
      const qty = this.toNum((it as any).qty) ?? 0;
      rows.push([String(it.name ?? '').trim(), qty, this.mysUnitCode(it.unit), '', '', '', '', '']);

      const offers = offersByItem.get(it.id) ?? [];
      if (!offers.length) {
        rows.push(['', '', '', '', '', '', '', '']);
        continue;
      }
      for (const o of offers) {
        rows.push(['', '', '', '', '', '', o.unitPrice, o.taxNo]);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Mys_yukle');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const filename = `DT-${file.year}-${file.fileNo}-mys-yukle.xlsx`
      .replace(/[^\w\u00C0-\u024F\s.-]/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 180);
    const key = `dogrudan_temin/generated/${uuidv4()}-mys-yukle.xlsx`;
    await this.uploadService.uploadBuffer(key, out, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const downloadUrl = await this.uploadService.getSignedDownloadUrl(key, 3600, filename);
    return { download_url: downloadUrl, filename };
  }

  private async recalcFileTotalsBestEffort(schoolId: string, dtFileId: string): Promise<void> {
    try {
      const items = await this.itemRepo.find({ where: { schoolId, dtFileId }, select: ['id', 'qty', 'estimatedUnitPrice'] as any });
      const approx = items.reduce((sum, it) => sum + (this.toNum(it.qty) ?? 0) * (this.toNum(it.estimatedUnitPrice) ?? 0), 0);
      const awards = await this.awardRepo.find({ where: { schoolId, dtFileId }, select: ['total'] as any });
      const decision = awards.reduce((sum, a) => sum + (this.toNum(a.total) ?? 0), 0);
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

  private async buildKomisyonOnayCommissionTableRows(
    schoolId: string,
    dtFileId: string,
  ): Promise<Array<{ kind: (typeof DT_COMMISSION_KINDS)[number]; rows: string[][] }>> {
    return Promise.all(
      DT_COMMISSION_KINDS.map(async (kind) => {
        const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId, kind } });
        if (!comm) return { kind, rows: [] as string[][] };
        const members = await this.commMemberRepo.find({ where: { commissionId: comm.id }, order: { createdAt: 'ASC' } });
        const ids = [...members.map((m) => m.userId), ...(comm.chairmanUserId ? [comm.chairmanUserId] : [])];
        const prof = await this.loadUserCommissionProfile(ids);
        const rows: string[][] = [];
        let n = 1;
        if (comm.chairmanUserId) {
          const p = prof.get(comm.chairmanUserId);
          rows.push([String(n++), p?.display ?? comm.chairmanUserId, p?.unvan ?? '—', 'Komisyon Başkanı']);
        }
        for (const m of members) {
          const p = prof.get(m.userId);
          const unvanCell = (m.title?.trim() || p?.unvan || '—') as string;
          rows.push([String(n++), p?.display ?? m.userId, unvanCell, (m.dutyLabel ?? 'Komisyon Üyesi') as string]);
        }
        return { kind, rows };
      }),
    );
  }

  private dtKomisyonOnayCommissionTableDocx(rows: string[][]): Table {
    const dotted = { style: BorderStyle.DOTTED, size: 8, color: '000000' };
    const allBorders = {
      top: dotted,
      bottom: dotted,
      left: dotted,
      right: dotted,
      insideHorizontal: dotted,
      insideVertical: dotted,
    };
    const colW = [1000, 3400, 2600, 2600];
    const th = (text: string) =>
      new TableCell({
        borders: allBorders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, size: 18, font: 'Times New Roman' })],
          }),
        ],
      });
    const td = (text: string, center = false) =>
      new TableCell({
        borders: allBorders,
        children: [
          new Paragraph({
            alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text, size: 18, font: 'Times New Roman' })],
          }),
        ],
      });
    const padded = [...rows];
    while (padded.length < 3) padded.push(['', '', '', '']);
    const headerRow = new TableRow({
      children: [th('Sıra No'), th('Adı Soyadı'), th('Ünvanı'), th('Görevi')],
    });
    const dataRows = padded.map(
      (r) =>
        new TableRow({
          children: [
            td(r[0] ?? '', true),
            td(r[1] ?? ''),
            td(r[2] ?? ''),
            td(r[3] ?? ''),
          ],
        }),
    );
    return new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: colW,
      borders: allBorders,
      rows: [headerRow, ...dataRows],
    });
  }

  private async buildKomisyonOnayDocx(
    schoolId: string,
    school: Pick<School, 'name' | 'principalName'> | null,
    file: DtFile,
    letterhead: Paragraph[],
  ): Promise<Buffer> {
    const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId } });
    const registryRows = await this.registryRepo.find({ where: { schoolId, dtFileId: file.id } });
    const byStage = new Map(registryRows.map((r) => [r.stage, r] as const));
    const olurDate = this.fmtTrDate(byStage.get('komisyon_onay')?.docDate ?? null) || this.fmtTrDate(new Date());

    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'komisyon_onay', {
      konuText: 'Yaklaşık Maliyet, Piyasa Araştırması ve Muayene Kabul Komisyon Onayı',
    });

    const kindLabel: Record<string, string> = {
      yaklasik_maliyet: 'Fiyat Araştırma ve Yaklaşık Maliyet Tesbit Komisyonu Adı, Ünvanı ve Görevleri',
      piyasa_satinalma: 'Piyasa Araştırma-Satın Alma İhale Komisyonu Adı, Ünvanı ve Görevleri',
      muayene_kabul: 'Muayene ve Teslim Alma Komisyonu Adı, Ünvanı ve Görevleri',
    };

    const commTables = await this.buildKomisyonOnayCommissionTableRows(schoolId, file.id);
    const schoolLine = (school?.name ?? 'Kurum').trim().toLocaleUpperCase('tr-TR');
    const bodyText = `${file.subject} işine ait ihtiyaç listesi onayı ekte sunulmuştur. Söz konusu mal/malzeme 4734 sayılı Kamu İhale Kanunu'nun 9. maddesi gereğince satın alınacağından; (1) Her türlü fiyat araştırmasını yapmak ve yaklaşık maliyet cetvelini hazırlayarak onaya sunmak üzere fiyat araştırma komisyonu, (2) Onay belgesinin tanziminden sonra yazılı teklif mektupları alarak değerlendirmek ve ihaleyi sonuçlandırarak onaya sunmak üzere ihale komisyonu, (3) Mal/malzeme tesliminden sonra satın alınan mal/malzemelerin özelliklerini ve sayılarını kontrol ederek teslim almak üzere muayene ve teslim alma komisyonu oluşturulması müdürlüğümüzce uygun görülmektedir. Makamınızca da uygun görüldüğü takdirde olurlarınıza arz ederim.`;

    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
    const cellNone = { top: none, bottom: none, left: none, right: none } as any;
    const arzName = settings?.realizationAuthorityName?.trim() || '…………………';
    const arzTitle = settings?.realizationAuthorityTitle?.trim();
    const spendName = settings?.spendingAuthorityName?.trim() || school?.principalName?.trim() || '…………………';
    const spendTitle = settings?.spendingAuthorityTitle?.trim() || 'Müdür';

    const signTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: none,
        bottom: none,
        left: none,
        right: none,
        insideHorizontal: none,
        insideVertical: none,
      },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: cellNone,
              children: [new Paragraph({ children: [new TextRun({ text: '', size: 2 })] })],
            }),
            new TableCell({
              borders: cellNone,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: arzName, bold: true, size: 20, font: 'Times New Roman' })],
                }),
                ...(arzTitle
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: arzTitle, size: 18, font: 'Times New Roman' })],
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        }),
      ],
    });

    const bodyParts: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${schoolLine} MÜDÜRLÜĞÜNE`, bold: true, size: 22, font: 'Times New Roman' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '(İhale/Harcama Yetkilisi)', size: 20, font: 'Times New Roman' })],
      }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: bodyText, size: 20, font: 'Times New Roman' })],
      }),
      new Paragraph({ spacing: { before: 180, after: 120 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      signTable,
      new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: ' ', size: 8 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'OLUR', bold: true, size: 24, font: 'Times New Roman' })],
      }),
    ];
    if (olurDate) {
      bodyParts.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: olurDate, size: 20, font: 'Times New Roman' })],
        }),
      );
    }
    bodyParts.push(
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: ' ', size: 6 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: spendName, bold: true, size: 20, font: 'Times New Roman' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: spendTitle, size: 18, font: 'Times New Roman' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'İhale (Harcama Yetkilisi)', size: 18, font: 'Times New Roman' })],
      }),
      new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: ' ', size: 6 })] }),
    );

    for (const t of commTables) {
      bodyParts.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [new TextRun({ text: kindLabel[t.kind] ?? t.kind, bold: true, size: 20, font: 'Times New Roman' })],
        }),
      );
      if (!t.rows.length) {
        bodyParts.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '(Henüz oluşturulmadı)', italics: true, size: 18, font: 'Times New Roman' })],
          }),
        );
      } else {
        bodyParts.push(this.dtKomisyonOnayCommissionTableDocx(t.rows));
      }
      bodyParts.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: ' ', size: 6 })] }));
    }

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
              margin: {
                top: convertInchesToTwip(0.98),
                right: convertInchesToTwip(0.98),
                bottom: convertInchesToTwip(0.98),
                left: convertInchesToTwip(1.18),
              },
            },
          },
          children: [...letterhead, ...corr, ...bodyParts],
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async loadOnayBelgesiModel(
    schoolId: string,
    school: Pick<School, 'name' | 'principalName'> | null,
    file: DtFile,
    items: DtItem[],
    registry: Map<string, DtFileDocumentRegistry>,
    settings: DtSchoolProcurementSettings | null,
  ) {
    const onayReg = registry.get('ihale_onay');
    const belgeTarih = this.fmtTrDate(onayReg?.docDate ?? null) || this.fmtTrDate(new Date());
    const belgeSayi = this.registrySayi(onayReg);
    const research = await this.quoteRepo.find({
      where: { schoolId, dtFileId: file.id, purpose: 'market_research' },
      order: { createdAt: 'ASC' },
      take: 12,
    });
    const firmQuotes = this.dedupeMarketResearchQuotes(research).slice(0, 3);
    const firmTotals = await Promise.all(
      firmQuotes.map(async (q) => {
        const qis = await this.quoteItemRepo.find({ where: { quoteId: q.id } });
        const byItem = new Map(qis.map((x) => [x.dtItemId, this.toNum(x.unitPrice)] as const));
        const total = items.reduce((acc, it) => acc + (byItem.get(it.id) ?? 0) * (this.toNum(it.qty) ?? 0), 0);
        return total;
      }),
    );
    const avgTotal = firmTotals.length ? firmTotals.reduce((a, b) => a + b, 0) / firmTotals.length : 0;
    const approxText =
      file.approxTotal != null && String(file.approxTotal).trim() !== ''
        ? this.fmtTry(this.toNum(file.approxTotal) ?? 0) || String(file.approxTotal).trim()
        : this.fmtTry(avgTotal) || '—';

    const assigned = await (async () => {
      const comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId: file.id, kind: 'yaklasik_maliyet' } });
      if (!comm) return [] as string[][];
      const members = await this.commMemberRepo.find({ where: { commissionId: comm.id }, order: { createdAt: 'ASC' } });
      const ids = [...members.map((m) => m.userId), ...(comm.chairmanUserId ? [comm.chairmanUserId] : [])];
      const prof = await this.loadUserCommissionProfile(ids);
      const out: string[][] = [];
      if (comm.chairmanUserId) {
        const p = prof.get(comm.chairmanUserId);
        out.push([p?.display ?? comm.chairmanUserId, 'Komisyon Başkanı', p?.unvan ?? '—']);
      }
      for (const m of members) {
        const p = prof.get(m.userId);
        const unvan = (m.title?.trim() || p?.unvan || '—') as string;
        out.push([p?.display ?? m.userId, (m.dutyLabel ?? 'Komisyon Üyesi') as string, unvan]);
      }
      return out;
    })();

    let butceTertibi = '';
    let kullanilabilirOdenek = '—';
    if (file.budgetAccountId) {
      const acc = await this.budgetRepo.findOne({ where: { id: file.budgetAccountId, schoolId } });
      if (acc) {
        const parts = [acc.code?.trim(), acc.label?.trim()].filter(Boolean);
        butceTertibi = parts.length ? parts.join(' / ') : acc.label;
        const alloc = this.toNum(acc.allocated) ?? 0;
        const blk = this.toNum(acc.blocked) ?? 0;
        const sp = this.toNum(acc.spent) ?? 0;
        const avail = alloc - blk - sp;
        if (Number.isFinite(avail)) kullanilabilirOdenek = this.fmtTry(avail) || '—';
      }
    }

    const schoolLine = (school?.name ?? 'Kurum').trim().toLocaleUpperCase('tr-TR');
    const assignedRows = assigned.length ? assigned : [['—', '—', '—']];
    return {
      belgeTarih,
      belgeSayi: belgeSayi.trim() || '—',
      idareninAdi: settings?.headerLine3?.trim() || 'İlçe Milli Eğitim Müdürlüğü',
      schoolMudUrluk: `${schoolLine} MÜDÜRLÜĞÜNE`,
      approxText,
      kullanilabilirOdenek,
      yatirimProjeNo: '',
      butceTertibi: butceTertibi.trim() || '—',
      procurementRef: file.procurementRef?.trim() || '—',
      isinTanimi: dtTeminTypeTr(file.teminType) || 'Mal/Malzeme Alımı',
      isinNiteligi: (file.subject ?? '').trim() || '—',
      assignedRows,
      realizationName: settings?.realizationAuthorityName?.trim() || '…………………',
      realizationTitle: settings?.realizationAuthorityTitle?.trim() || 'Müdür Yardımcısı',
      spendingName: settings?.spendingAuthorityName?.trim() || school?.principalName?.trim() || '…………………',
      spendingTitle: settings?.spendingAuthorityTitle?.trim() || 'Müdür',
    };
  }

  private async buildOnayBelgesiDocx(
    schoolId: string,
    school: Pick<School, 'name' | 'principalName'> | null,
    file: DtFile,
    letterhead: Paragraph[],
    items: DtItem[],
  ): Promise<Buffer> {
    const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId } });
    const registry = await this.registryMapForFile(schoolId, file.id);
    const m = await this.loadOnayBelgesiModel(schoolId, school, file, items, registry, settings);

    const b = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
    };
    const shade = { fill: 'E8EEF5' } as any;
    const cellL = (text: string) =>
      new TableCell({
        borders: b,
        shading: shade,
        children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
      });
    const cellR = (text: string) =>
      new TableCell({
        borders: b,
        shading: shade,
        children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
      });
    const twoCol = [3200, 6160] as const;
    const mk2 = (rows: Array<[string, string]>) =>
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [...twoCol],
        borders: b,
        rows: rows.map(([l, r]) => new TableRow({ children: [cellL(l), cellR(r)] })),
      });

    const finRows: Array<[string, string]> = [
      ['Yaklaşık Maliyet (KDV Hariç)(₺):', m.approxText],
      ['Kullanılabilir Ödenek Tutarı (KDV Dahil)(₺):', m.kullanilabilirOdenek],
      ['Yatırım Proje Numarası (Varsa):', m.yatirimProjeNo],
      ['Bütçe Tertibi:', m.butceTertibi],
      ['Avans Verilecekse Şartları:', 'Verilmeyecektir.'],
      ["İhale Usulü:", "4734 Sayılı Kamu İhale Kanunu'nun 22/d Maddesi"],
      ['İlanın Şekli ve Adedi:', 'Yapılmayacak'],
      ['Ön Yeterlik/İhale Dokümanı Satış Bedeli:', '0'],
      ['Fiyat Farkı Ödenecekse Dayanağı BKK:', 'Ödenmeyecektir'],
      ['Sözleşme Düzenlenip Düzenlenmeyeceği:', 'Düzenlenmeyecektir'],
      ['Şartname Düzenlenip Düzenlenmeyeceği:', 'Düzenlenecektir'],
      ['Yeterlilik Kriterleri Aranıp Aranmayacağı:', 'Aranmayacaktır'],
    ];

    const th3 = (t: string) =>
      new TableCell({
        borders: b,
        shading: shade,
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18 })] })],
      });
    const td3 = (t: string) =>
      new TableCell({
        borders: b,
        shading: shade,
        children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })],
      });
    const commTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3600, 2880, 2880],
      borders: b,
      rows: [
        new TableRow({ children: [th3('Adı Soyadı'), th3('Görevi'), th3('Ünvanı')] }),
        ...m.assignedRows.map(
          (row) =>
            new TableRow({
              children: [td3(row[0] ?? ''), td3(row[1] ?? ''), td3(row[2] ?? '')],
            }),
        ),
      ],
    });

    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
    const cellNone = { top: none, bottom: none, left: none, right: none } as any;
    const d = m.belgeTarih;
    const signTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [4680, 4680],
      borders: {
        top: none,
        bottom: none,
        left: none,
        right: none,
        insideHorizontal: none,
        insideVertical: none,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: cellNone,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'alınması için ilgililerin görevlendirilmeleri hususunu',
                      size: 17,
                    }),
                  ],
                }),
                new Paragraph({ spacing: { before: 140 }, children: [new TextRun({ text: ' ', size: 4 })] }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: d, size: 18 })],
                }),
                new Paragraph({ spacing: { before: 140 }, children: [new TextRun({ text: ' ', size: 4 })] }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: m.realizationName, bold: true, size: 18 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: m.realizationTitle, size: 18 })],
                }),
              ],
            }),
            new TableCell({
              borders: cellNone,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'UYGUNDUR', bold: true, size: 22 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100 },
                  children: [new TextRun({ text: 'İhale Yetkilisi Adı-Soyadı-Ünvanı', size: 15 })],
                }),
                new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: ' ', size: 4 })] }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: d, size: 18 })],
                }),
                new Paragraph({ spacing: { before: 140 }, children: [new TextRun({ text: ' ', size: 4 })] }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: m.spendingName, bold: true, size: 18 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: m.spendingTitle, size: 18 })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const digerTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [9360],
      borders: b,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: b,
              shading: shade,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'DİĞER AÇIKLAMALAR', bold: true, size: 20 })],
                }),
                new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
                new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
                new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
              ],
            }),
          ],
        }),
      ],
    });

    const bodyParts: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: 'ONAY BELGESİ', bold: true, size: 26 })],
      }),
      mk2([
        ['Doğrudan Temini Yapan İdarenin Adı:', m.idareninAdi],
        ['Belge Tarih ve Sayısı:', `${m.belgeTarih}     ${m.belgeSayi}`.trim()],
      ]),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: m.schoolMudUrluk, bold: true, size: 22 })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: 'İhale/Harcama Yetkilisi', size: 18 })],
      }),
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      mk2([
        ['Doğrudan Temin Numarası', m.procurementRef],
        ['İşin Tanımı', m.isinTanimi],
        ['İşin Niteliği', m.isinNiteligi],
        ['İşin Miktarı', 'Ekli belgede gösterilmiştir.'],
      ]),
      mk2(finRows),
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [
          new TextRun({
            text: 'Doğrudan Temin Usulü ile Mal ve Hizmet satın alınacaksa piyasa fiyat araştırması yapmak üzere görevlendirilecek kişi/kişiler',
            bold: true,
            size: 18,
          }),
        ],
      }),
      commTable,
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      digerTable,
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 220, after: 120 },
        children: [new TextRun({ text: 'ONAY', bold: true, size: 22 })],
      }),
      signTable,
      new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Ek: İdare Tarafından Hazırlanan Yaklaşık Maliyet Hesap Cetveli',
            size: 16,
          }),
        ],
      }),
    ];

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
              margin: {
                top: convertInchesToTwip(0.98),
                right: convertInchesToTwip(0.98),
                bottom: convertInchesToTwip(0.98),
                left: convertInchesToTwip(1.18),
              },
            },
          },
          children: [...letterhead, ...bodyParts],
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildPiyasaArastirmaTutanagiDocx(input: {
    schoolId: string;
    school: Pick<School, 'name' | 'principalName'> | null;
    letterhead: Paragraph[];
    file: DtFile;
    items: DtItem[];
    cols: Array<{
      quote: DtQuote;
      vendor: DtVendor | null;
      title: string;
      firmLabel: string;
      byItem: Map<string, number | null>;
      total: number;
      complete: boolean;
    }>;
    lowest:
      | {
          quote: DtQuote;
          vendor: DtVendor | null;
          title: string;
          firmLabel: string;
          byItem: Map<string, number | null>;
          total: number;
          complete: boolean;
        }
      | null;
    commissionBlocks: Array<{ name: string; title?: string; role?: string }>;
  }): Promise<Buffer> {
    const { schoolId, school, letterhead, file, items, cols, lowest, commissionBlocks } = input;
    const registry = await this.registryMapForFile(schoolId, file.id);
    const onay = registry.get('ihale_onay');
    const piyasaReg = registry.get('piyasa_arastirma');
    const onayTarih = this.fmtTrDate(onay?.docDate ?? null);
    const onaySayi = this.registrySayi(onay);
    const tutanakTarih = this.fmtTrDate(piyasaReg?.docDate ?? null) || this.fmtTrDate(new Date());
    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'piyasa_arastirma', { textSizeHalfPts: 22 });
    const trf = 'Times New Roman';
    const headGap = new Paragraph({
      spacing: { before: 40, after: 60 },
      children: [new TextRun({ text: '\u00a0', size: 4, font: trf })],
    });
    const solid = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
    } as const;
    const hdr = { fill: 'D9E1F2' } as any;
    const td = (t: string, dataSize = 18) =>
      new TableCell({
        borders: solid,
        children: [
          new Paragraph({
            spacing: { before: 12, after: 12 },
            children: [new TextRun({ text: t, size: dataSize, font: trf })],
          }),
        ],
      });
    const lbl = (t: string) =>
      new TableCell({
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            spacing: { before: 12, after: 12 },
            children: [new TextRun({ text: t, bold: true, size: 18, font: trf })],
          }),
        ],
      });
    const fmtN = (n: number) =>
      new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const idare = `${((school?.name ?? '').trim() || 'Kurum').toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜ`;
    const onayLine = [onayTarih, onaySayi].filter(Boolean).join('  ') || '—';
    const infoTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [2200, 7160],
      borders: solid,
      rows: [
        new TableRow({ children: [lbl('İdarenin Adı'), td(idare)] }),
        new TableRow({ children: [lbl('Doğrudan Temin Numarası'), td(file.procurementRef?.trim() || '—')] }),
        new TableRow({ children: [lbl('İşin Konusu'), td(file.subject)] }),
        new TableRow({
          children: [
            lbl('Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi/Görevlendirme Onayı Tarih ve No.su'),
            td(onayLine),
          ],
        }),
        new TableRow({ children: [lbl('Tutanak Tarihi'), td(tutanakTarih)] }),
      ],
    });

    const titleBits: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 100 },
        children: [new TextRun({ text: 'PİYASA FİYAT ARAŞTIRMA TUTANAĞI', bold: true, size: 28, font: trf })],
      }),
      infoTable,
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ' ', size: 4 })] }),
    ];

    const baseW = [440, 2480, 2080, 520, 520];
    const rem = Math.max(400, 9360 - baseW.reduce((a, b) => a + b, 0));
    const wPair = cols.length ? Math.floor(rem / (cols.length * 2)) : 400;
    const columnWidths = [...baseW, ...Array.from({ length: cols.length * 2 }, () => wPair)];

    const thR2 = (t: string) =>
      new TableCell({
        rowSpan: 2,
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 20, after: 20 },
            children: [new TextRun({ text: t, bold: true, size: 20, font: trf })],
          }),
        ],
      });
    const th1 = (t: string) =>
      new TableCell({
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 12, after: 12 },
            children: [new TextRun({ text: t, bold: true, size: 18, font: trf })],
          }),
        ],
      });

    const headerRow1 = new TableRow({
      children: [
        thR2('Sıra No'),
        thR2('Malzemenin Adı'),
        thR2('Özelliği'),
        thR2('Miktar'),
        thR2('Ölçü birimi'),
        ...cols.map((c, i) => {
          const letter = String.fromCharCode(65 + i);
          const sub = this.dtFirmTableSubtitle(letter, (c.title ?? '').trim());
          const runs = [new TextRun({ text: `${letter} FİRMASI`, bold: true, size: 22, font: trf })];
          if (sub) runs.push(new TextRun({ text: `\n${sub.slice(0, 48)}`, bold: true, size: 18, font: trf }));
          return new TableCell({
            columnSpan: 2,
            shading: hdr,
            borders: solid,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 16, after: 16 },
                children: runs,
              }),
            ],
          });
        }),
      ],
    });

    const headerRow2 = new TableRow({
      children: cols.flatMap(() => [
        th1('Birim fiyatı (KDV hariç)'),
        th1('Toplam fiyat (KDV hariç)'),
      ]),
    });

    const headCells = [headerRow1, headerRow2];

    const dataRows = cols.length
      ? items.map((it, idx) => {
          const qty = this.toNum(it.qty) ?? 0;
          return new TableRow({
            children: [
              td(String(idx + 1)),
              td(String(it.name ?? '')),
              td(String(it.spec ?? '')),
              td(this.fmtFiyatTableQty(it.qty)),
              td(String(it.unit ?? '')),
              ...cols.flatMap((c) => {
                const p = c.byItem.get(it.id);
                const t = p != null && Number.isFinite(p) ? p * qty : null;
                return [td(p != null && Number.isFinite(p) ? fmtN(p) : ''), td(t != null && Number.isFinite(t) ? fmtN(t) : '')];
              }),
            ],
          });
        })
      : [];

    const footRow = cols.length
      ? new TableRow({
          children: [
            new TableCell({
              columnSpan: 5,
              shading: hdr,
              borders: solid,
              children: [
                new Paragraph({
                  spacing: { before: 12, after: 12 },
                  children: [new TextRun({ text: 'TOPLAM TEKLİF', bold: true, size: 20, font: trf })],
                }),
              ],
            }),
            ...cols.flatMap((c) => [td(''), td(Number.isFinite(c.total) ? `${fmtN(c.total)}₺` : '')]),
          ],
        })
      : null;

    const mainTable =
      cols.length && footRow
        ? new Table({
            layout: TableLayoutType.FIXED,
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths,
            borders: solid,
            rows: [...headCells, ...dataRows, footRow],
          })
        : null;

    const tableOrMsg: (Paragraph | Table)[] = mainTable
      ? [mainTable]
      : [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Bu dosya için «Araştırma» amaçlı teklif kaydı yok; karşılaştırma tablosu oluşturulamadı.',
                italics: true,
                size: 16,
                font: trf,
              }),
            ],
          }),
        ];

    const blocks =
      commissionBlocks.length > 0
        ? commissionBlocks
        : [
            { name: '…………………', role: '', title: '' },
            { name: '…………………', role: '', title: '' },
            { name: '…………………', role: '', title: '' },
          ];
    const signTableRows: TableRow[] = [];
    for (let i = 0; i < blocks.length; i += 3) {
      const chunk = blocks.slice(i, i + 3);
      const pad = [...chunk];
      while (pad.length < 3) pad.push({ name: '…………………', role: '', title: '' });
      signTableRows.push(
        new TableRow({
          children: pad.map(
            (b) =>
              new TableCell({
                borders: solid,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 24, after: 0 },
                    children: [new TextRun({ text: (b.role ?? '').trim() || 'Komisyon Üyesi', size: 16, font: trf })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 0 },
                    children: [new TextRun({ text: this.dtCommissionSignNameUpper(b.name), bold: true, size: 18, font: trf })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 24 },
                    children: [new TextRun({ text: (b.title ?? '').trim() || '\u00a0', size: 16, font: trf })],
                  }),
                ],
              }),
          ),
        }),
      );
    }
    const signTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [3120, 3120, 3120],
      borders: solid,
      rows: signTableRows,
    });

    const adCell = (k: string) =>
      new TableCell({
        shading: hdr,
        borders: solid,
        children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 12, font: trf })] })],
      });
    const vCell = (v: string) =>
      new TableCell({
        borders: solid,
        children: [new Paragraph({ children: [new TextRun({ text: v, size: 12, font: trf })] })],
      });

    const afterTable: (Paragraph | Table)[] = [
      new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: ' ', size: 2 })] }),
    ];
    if (lowest) {
      afterTable.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: file.subject, bold: true, size: 18, font: trf })],
        }),
      );
      afterTable.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: 'Tümünün Bu Kişi/Firmadan Alımı Uygun Görülmüştür', bold: true, size: 18, font: trf }),
          ],
        }),
      );
      afterTable.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [2200, 7160],
          layout: TableLayoutType.FIXED,
          borders: solid,
          rows: [
            new TableRow({ children: [adCell('Adı'), vCell(`${lowest.firmLabel}\n${lowest.title}`.trim())] }),
            new TableRow({ children: [adCell('Adresi'), vCell((lowest.vendor?.address ?? '').trim() || '—')] }),
            new TableRow({
              children: [
                adCell('Teklif Ettiği Fiyat (KDV Hariç)'),
                vCell(Number.isFinite(lowest.total) ? this.fmtTry(lowest.total) : '—'),
              ],
            }),
          ],
        }),
      );
    }

    afterTable.push(new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: ' ', size: 2 })] }));
    afterTable.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 60, line: 240 },
        children: [
          new TextRun({
            text: `4734 sayılı Kamu İhale Kanunu'nun 22. maddesi uyarınca doğrudan temin usulüyle yapılacak alımlara ilişkin yapılan piyasa araştırmasında firmalarca/kişilerce teklif edilen fiyatlar değerlendirilerek yukarıda adı ve adresleri belirtilen kişi/firma/firmalardan alım yapılması uygun görülmüştür.`,
            size: 20,
            font: trf,
          }),
        ],
      }),
    );
    afterTable.push(new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: ' ', size: 2 })] }));
    afterTable.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: 'PİYASA FİYAT ARAŞTIRMA GÖREVLİSİ / GÖREVLİLERİ',
            bold: true,
            size: 20,
            font: trf,
          }),
        ],
      }),
    );
    afterTable.push(new Paragraph({ children: [new TextRun({ text: ' ', size: 2 })] }));
    afterTable.push(signTable);

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
              margin: {
                top: convertInchesToTwip(0.35),
                right: convertInchesToTwip(0.45),
                bottom: convertInchesToTwip(0.35),
                left: convertInchesToTwip(0.5),
              },
            },
          },
          children: [...letterhead, headGap, ...corr, ...titleBits, ...tableOrMsg, ...afterTable],
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildYaklasikMaliyetCetveliDocx(input: {
    schoolId: string;
    school: Pick<School, 'name' | 'principalName'> | null;
    letterhead: Paragraph[];
    file: DtFile;
    items: DtItem[];
    cols: Array<{
      quote: DtQuote;
      vendor: DtVendor | null;
      title: string;
      firmLabel: string;
      byItem: Map<string, number | null>;
      total: number;
      complete: boolean;
    }>;
    commissionBlocks: Array<{ name: string; title?: string; role?: string }>;
  }): Promise<Buffer> {
    const { schoolId, school, letterhead, file, items, cols, commissionBlocks } = input;
    const registry = await this.registryMapForFile(schoolId, file.id);
    const ymReg = registry.get('yaklasik_maliyet');
    const düzen = this.fmtTrDate(ymReg?.docDate ?? null) || this.fmtTrDate(new Date());
    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'yaklasik_maliyet', { textSizeHalfPts: 22 });
    const trf = 'Times New Roman';
    const headGap = new Paragraph({
      spacing: { before: 40, after: 60 },
      children: [new TextRun({ text: '\u00a0', size: 4, font: trf })],
    });
    const solid = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
    } as const;
    const hdr = { fill: 'D9E1F2' } as any;
    const td = (t: string, dataSize = 18) =>
      new TableCell({
        borders: solid,
        children: [
          new Paragraph({
            spacing: { before: 12, after: 12 },
            children: [new TextRun({ text: t, size: dataSize, font: trf })],
          }),
        ],
      });
    const lbl = (t: string) =>
      new TableCell({
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            spacing: { before: 12, after: 12 },
            children: [new TextRun({ text: t, bold: true, size: 18, font: trf })],
          }),
        ],
      });
    const fmtN = (n: number) =>
      new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const infoTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [2200, 7160],
      borders: solid,
      rows: [
        new TableRow({
          children: [
            lbl('İdarenin Adı'),
            td(`${((school?.name ?? '').trim() || 'Kurum').toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜ`),
          ],
        }),
        new TableRow({
          children: [lbl('Doğrudan Temin Numarası'), td(file.procurementRef?.trim() || '—')],
        }),
        new TableRow({ children: [lbl('İşin Konusu'), td(file.subject)] }),
        new TableRow({ children: [lbl('Düzenleme Tarihi'), td(düzen)] }),
      ],
    });

    const titleBits: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 100 },
        children: [new TextRun({ text: 'YAKLAŞIK MALİYET CETVELİ', bold: true, size: 28, font: trf })],
      }),
      infoTable,
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ' ', size: 4 })] }),
    ];

    const baseW = [440, 2480, 2080, 520, 520];
    const approxPair = 1020;
    const rem = Math.max(400, 9360 - baseW.reduce((a, b) => a + b, 0) - approxPair);
    const wPair = cols.length ? Math.floor(rem / (cols.length * 2)) : 400;
    const wA = Math.floor(approxPair / 2);
    const columnWidths = [...baseW, ...Array.from({ length: cols.length * 2 }, () => wPair), wA, wA];

    const thR2 = (t: string) =>
      new TableCell({
        rowSpan: 2,
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 20, after: 20 },
            children: [new TextRun({ text: t, bold: true, size: 20, font: trf })],
          }),
        ],
      });
    const th1 = (t: string) =>
      new TableCell({
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 12, after: 12 },
            children: [new TextRun({ text: t, bold: true, size: 18, font: trf })],
          }),
        ],
      });

    const headerRow1 = new TableRow({
      children: [
        thR2('Sıra No'),
        thR2('Malzemenin Adı'),
        thR2('Özelliği'),
        thR2('Miktar'),
        thR2('Ölçü birimi'),
        ...cols.map((c, i) => {
          const letter = String.fromCharCode(65 + i);
          const sub = this.dtFirmTableSubtitle(letter, (c.title ?? '').trim());
          const runs = [new TextRun({ text: `${letter} FİRMASI`, bold: true, size: 22, font: trf })];
          if (sub) runs.push(new TextRun({ text: `\n${sub.slice(0, 48)}`, bold: true, size: 18, font: trf }));
          return new TableCell({
            columnSpan: 2,
            shading: hdr,
            borders: solid,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 16, after: 16 },
                children: runs,
              }),
            ],
          });
        }),
        new TableCell({
          rowSpan: 2,
          shading: hdr,
          borders: solid,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({ text: 'Birim yaklaşık maliyet (KDV hariç)', bold: true, size: 18, font: trf }),
              ],
            }),
          ],
        }),
        new TableCell({
          rowSpan: 2,
          shading: hdr,
          borders: solid,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({ text: 'Toplam yaklaşık maliyet (KDV hariç)', bold: true, size: 18, font: trf }),
              ],
            }),
          ],
        }),
      ],
    });
    const headerRow2 = new TableRow({
      children: cols.flatMap(() => [
        th1('Birim fiyatı (KDV hariç)'),
        th1('Toplam fiyat (KDV hariç)'),
      ]),
    });

    let grandApprox = 0;
    const dataRows = cols.length
      ? items.map((it, idx) => {
          const qty = this.toNum(it.qty) ?? 0;
          const nums = cols.map((c) => c.byItem.get(it.id) ?? null).filter((p): p is number => p != null && Number.isFinite(p));
          const avgUnit = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
          const avgLine = Number.isFinite(avgUnit) ? avgUnit * qty : 0;
          grandApprox += avgLine;
          return new TableRow({
            children: [
              td(String(idx + 1)),
              td(String(it.name ?? '')),
              td(String(it.spec ?? '')),
              td(this.fmtFiyatTableQty(it.qty)),
              td(String(it.unit ?? '')),
              ...cols.flatMap((c) => {
                const p = c.byItem.get(it.id) ?? null;
                const t = p != null && Number.isFinite(p) ? p * qty : null;
                return [td(p != null && Number.isFinite(p) ? fmtN(p) : ''), td(t != null && Number.isFinite(t) ? fmtN(t) : '')];
              }),
              td(Number.isFinite(avgUnit) ? fmtN(avgUnit) : ''),
              td(Number.isFinite(avgLine) ? fmtN(avgLine) : ''),
            ],
          });
        })
      : [];

    const foot1 =
      cols.length > 0
        ? new TableRow({
            children: [
              new TableCell({
                columnSpan: 5,
                shading: hdr,
                borders: solid,
                children: [
                  new Paragraph({
                    spacing: { before: 12, after: 12 },
                    children: [new TextRun({ text: 'TOPLAM', bold: true, size: 20, font: trf })],
                  }),
                ],
              }),
              ...cols.flatMap((c) => [
                td(''),
                td(Number.isFinite(c.total) ? `${fmtN(c.total)}₺` : ''),
              ]),
              td(''),
              td(''),
            ],
          })
        : null;
    const foot2 = new TableRow({
      children: [
        new TableCell({
          columnSpan: Math.max(1, 5 + cols.length * 2),
          borders: solid,
          children: [
            new Paragraph({
              spacing: { before: 12, after: 12 },
              children: [new TextRun({ text: 'Yaklaşık maliyet tutarı (KDV hariç)', bold: true, size: 20, font: trf })],
            }),
          ],
        }),
        td(''),
        td(Number.isFinite(grandApprox) ? `${fmtN(grandApprox)}₺` : ''),
      ],
    });

    const mainTable =
      cols.length
        ? new Table({
            layout: TableLayoutType.FIXED,
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths,
            borders: solid,
            rows: [headerRow1, headerRow2, ...dataRows, ...(foot1 ? [foot1] : []), foot2],
          })
        : null;

    const tableOrMsg: (Paragraph | Table)[] = mainTable
      ? [mainTable]
      : [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Bu dosya için «Araştırma» amaçlı teklif kaydı yok; cetvel oluşturulamadı.',
                italics: true,
                size: 16,
                font: trf,
              }),
            ],
          }),
        ];

    const blocks =
      commissionBlocks.length > 0
        ? commissionBlocks
        : [
            { name: '…………………', role: 'Komisyon Üyesi', title: '' },
            { name: '…………………', role: 'Komisyon Üyesi', title: '' },
            { name: '…………………', role: 'Komisyon Üyesi', title: '' },
          ];
    const signTableRows: TableRow[] = [];
    for (let i = 0; i < blocks.length; i += 3) {
      const chunk = blocks.slice(i, i + 3);
      const pad = [...chunk];
      while (pad.length < 3) pad.push({ name: '…………………', role: 'Komisyon Üyesi', title: '' });
      signTableRows.push(
        new TableRow({
          children: pad.map(
            (b) =>
              new TableCell({
                borders: solid,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 24, after: 0 },
                    children: [new TextRun({ text: (b.role ?? '').trim() || 'Komisyon Üyesi', size: 16, font: trf })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 0 },
                    children: [
                      new TextRun({
                        text: this.dtCommissionSignNameUpper(b.name),
                        bold: true,
                        size: 18,
                        font: trf,
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 12, after: 24 },
                    children: [new TextRun({ text: (b.title ?? '').trim() || '\u00a0', size: 16, font: trf })],
                  }),
                ],
              }),
          ),
        }),
      );
    }
    const signTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [3120, 3120, 3120],
      borders: solid,
      rows: signTableRows,
    });

    const after: (Paragraph | Table)[] = [
      new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: ' ', size: 2 })] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 60, line: 240 },
        children: [
          new TextRun({
            text: `İdaremizce ihtiyaç duyulan ve satın alınması düşünülen aşağıda cinsi, özellikleri ve miktarları yazılı malların/hizmetlerin 4734 sayılı Kamu İhale Kanunu'nun 9. maddesi gereğince yaklaşık maliyetinin tespitine esas olmak üzere her türlü fiyat araştırması yapılmıştır. Araştırma sonuçları yukarıdaki tabloda gösterilmiştir. Yukarıda açıklandığı üzere yaklaşık maliyetin KDV hariç ${
              Number.isFinite(grandApprox) ? this.fmtTry(grandApprox) : '—'
            } takdir ve tespit edilerek iş bu hesap cetveli düzenlenerek imza altına alınmıştır.`,
            size: 20,
            font: trf,
          }),
        ],
      }),
      new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: ' ', size: 2 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: 'YAKLAŞIK MALİYETİ YAPAN GÖREVLİ / GÖREVLİLER', bold: true, size: 20, font: trf }),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 2 })] }),
      signTable,
    ];

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
              margin: {
                top: convertInchesToTwip(0.35),
                right: convertInchesToTwip(0.45),
                bottom: convertInchesToTwip(0.35),
                left: convertInchesToTwip(0.5),
              },
            },
          },
          children: [...letterhead, headGap, ...corr, ...titleBits, ...tableOrMsg, ...after],
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildQuoteFirmMatrixDocx(input: {
    letterhead: Paragraph[];
    file: DtFile;
    items: DtItem[];
    vendorById: Map<string, DtVendor>;
    quotes: DtQuote[];
    docTitle: string;
    registryStage: 'piyasa_arastirma' | 'yaklasik_maliyet';
  }): Promise<Buffer> {
    const { letterhead, file, items, vendorById, quotes, docTitle, registryStage } = input;
    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, registryStage);
    const firmQuotes = this.dedupeMarketResearchQuotes(quotes).slice(0, 3);
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
        ...colData.map((c) => th((c.title ?? '').trim().slice(0, 36) || 'Firma')),
      ],
    });
    const dataRows = items.map((it, idx) => {
      const cells = [
        td(String(idx + 1)),
        td(`${it.name}${it.spec ? `\n${it.spec}` : ''}`),
        td(`${it.qty ?? ''} ${it.unit ?? ''}`.trim()),
        ...colData.map((c) => {
          const n = this.toNum(c.byItem.get(it.id));
          const cell =
            n == null
              ? ''
              : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
          return td(cell);
        }),
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
    const doc = new DocxDocument({ styles: this.dtDocxDefaultStyles() as any, sections: [{ properties: {}, children: [...letterhead, ...corr, ...sub, table] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildIhtiyacListesiDocx(input: {
    school: Pick<School, 'name' | 'principalName'> | null;
    file: DtFile;
    items: DtItem[];
    letterhead: Paragraph[];
  }): Promise<Buffer> {
    const { school, file, items, letterhead } = input;
    const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId: file.schoolId } });
    const { blocks: corr, docDateFormatted: tarih } = await this.buildDtDocxCorrespondenceHeader(file, 'ihtiyac_listesi');
    const tnr = 'Times New Roman';
    const header = [
      ...letterhead,
      ...corr,
      new Paragraph({
        spacing: { before: 160, after: 220 },
        children: [new TextRun({ text: 'MAL/MALZEME İHTİYAÇ LİSTESİ', bold: true, size: 28, font: tnr })],
        alignment: AlignmentType.CENTER,
      }),
    ];

    const solid = { style: BorderStyle.SINGLE, size: 4, color: '000000' } as const;
    const dotted = { style: BorderStyle.DOTTED, size: 6, color: '000000' } as const;
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;

    const thCell = (text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
      new TableCell({
        borders: { top: solid, bottom: solid, left: solid, right: solid },
        children: [
          new Paragraph({
            alignment: align,
            children: [new TextRun({ text, bold: true, size: 22, font: tnr })],
          }),
        ],
      });

    const headerRow = new TableRow({
      children: [
        thCell('Sıra No', AlignmentType.CENTER),
        thCell('Mal/Malzemenin Adı', AlignmentType.CENTER),
        thCell('Özelliği', AlignmentType.CENTER),
        thCell('Miktarı', AlignmentType.CENTER),
        thCell('Ölçeği', AlignmentType.CENTER),
      ],
    });

    const n = items.length;
    const tdCell = (text: string, colIdx: number, rowIdx: number) => {
      const align =
        colIdx === 0 || colIdx === 3 || colIdx === 4 ? AlignmentType.CENTER : AlignmentType.LEFT;
      const top = rowIdx === 0 ? none : dotted;
      const bottom = rowIdx === n - 1 ? solid : dotted;
      return new TableCell({
        borders: { top, bottom, left: solid, right: solid },
        children: [
          new Paragraph({
            alignment: align,
            children: [new TextRun({ text, size: 22, font: tnr })],
          }),
        ],
      });
    };

    const dataRows = items.map(
      (it, idx) =>
        new TableRow({
          children: this.ihtiyacListesiTableRowCells(it, idx).map((cell, colIdx) => tdCell(cell, colIdx, idx)),
        }),
    );

    const table = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [900, 3200, 2660, 1300, 1300],
      borders: {
        top: none,
        bottom: none,
        left: none,
        right: none,
        insideHorizontal: none,
        insideVertical: none,
      },
      rows: [headerRow, ...dataRows],
    });

    const raName = (settings?.realizationAuthorityName ?? '').trim() || '…………………';
    const raTitle = (settings?.realizationAuthorityTitle ?? '').trim();
    const spName = (settings?.spendingAuthorityName ?? school?.principalName ?? '').trim() || '…………………';
    const spTitle = (settings?.spendingAuthorityTitle ?? '').trim();

    const cellNone = { top: none, bottom: none, left: none, right: none } as any;
    const signRealTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: none,
        bottom: none,
        left: none,
        right: none,
        insideHorizontal: none,
        insideVertical: none,
      },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({
          children: [
            new TableCell({ borders: cellNone, children: [new Paragraph({ children: [new TextRun({ text: '', size: 4 })] })] }),
            new TableCell({
              borders: cellNone,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: raName, bold: true, size: 22, font: tnr })],
                }),
                ...(raTitle
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: raTitle, size: 20, font: tnr })],
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        }),
      ],
    });

    const mud = `${((school?.name ?? '').trim() || 'Kurum').toUpperCase()} MÜDÜRLÜĞÜNE`;
    const footer: any[] = [
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: ' ', size: 6 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: mud, bold: true, size: 22, font: tnr })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [new TextRun({ text: '(İhale/Harcama Yetkilisi)', size: 20, font: tnr })],
      }),
      new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: this.ihtiyacListesiKanunMetniTr(), size: 22, font: tnr })],
      }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      signRealTable,
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: ' ', size: 6 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'OLUR', bold: true, size: 24, font: tnr })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [new TextRun({ text: tarih || this.fmtTrDate(new Date()), size: 20, font: tnr })],
      }),
      new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: ' ', size: 6 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: spName, bold: true, size: 22, font: tnr })],
      }),
      ...(spTitle
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40 },
              children: [new TextRun({ text: spTitle, size: 20, font: tnr })],
            }),
          ]
        : []),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [new TextRun({ text: 'İhale(Harcama Yetkilisi)', size: 20, font: tnr })],
      }),
    ];

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
              margin: {
                top: convertInchesToTwip(0.98),
                right: convertInchesToTwip(0.98),
                bottom: convertInchesToTwip(0.98),
                left: convertInchesToTwip(1.18),
              },
            },
          },
          children: [...header, table, ...footer] as any,
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async buildMuayeneKabulDocx(input: {
    schoolId: string;
    school: Pick<School, 'name' | 'principalName'> | null;
    letterhead: Paragraph[];
    file: DtFile;
    items: DtItem[];
    awardByItemId: Map<string, DtAward>;
    commissionBlocks: Array<{ name: string; title?: string; role?: string }>;
  }): Promise<Buffer> {
    const { schoolId, school, letterhead, file, items, awardByItemId, commissionBlocks } = input;
    const registry = await this.registryMapForFile(schoolId, file.id);
    const reg = registry.get('muayene_kabul');
    const kararNo = String((reg?.meta as { karar_no?: string } | null)?.karar_no ?? '').trim();
    const kararTarih = this.fmtTrDate(reg?.docDate ?? null) || this.fmtTrDate(new Date());
    const idare = `${((school?.name ?? '').trim() || 'Kurum').toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜ`;
    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'muayene_kabul', { textSizeHalfPts: 22 });
    const trf = 'Times New Roman';
    const headGap = new Paragraph({
      spacing: { before: 40, after: 60 },
      children: [new TextRun({ text: '\u00a0', size: 4, font: trf })],
    });
    const solid = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
    } as const;
    const hdr = { fill: 'D9E1F2' } as any;
    const td = (t: string, dataSize = 18) =>
      new TableCell({
        borders: solid,
        children: [
          new Paragraph({
            spacing: { before: 10, after: 10 },
            children: [new TextRun({ text: t, size: dataSize, font: trf })],
          }),
        ],
      });
    const tdC = (t: string, dataSize = 18) =>
      new TableCell({
        borders: solid,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 10, after: 10 },
            children: [new TextRun({ text: t, size: dataSize, font: trf })],
          }),
        ],
      });
    const lbl = (t: string) =>
      new TableCell({
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            spacing: { before: 10, after: 10 },
            children: [new TextRun({ text: t, bold: true, size: 18, font: trf })],
          }),
        ],
      });
    type DocxAlign = (typeof AlignmentType)[keyof typeof AlignmentType];
    const thc = (t: string, align: DocxAlign = AlignmentType.CENTER) =>
      new TableCell({
        shading: hdr,
        borders: solid,
        children: [
          new Paragraph({
            alignment: align,
            spacing: { before: 10, after: 10 },
            children: [new TextRun({ text: t, bold: true, size: 17, font: trf })],
          }),
        ],
      });

    const infoTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [2200, 7160],
      borders: solid,
      rows: [
        new TableRow({ children: [lbl('Karar No'), td(kararNo || '—')] }),
        new TableRow({ children: [lbl('Karar Tarihi'), td(kararTarih)] }),
        new TableRow({ children: [lbl('İdarenin Adı'), td(idare)] }),
        new TableRow({ children: [lbl('İşin Adı/Niteliği'), td(file.subject)] }),
      ],
    });

    const titleBlock: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 100 },
        children: [new TextRun({ text: 'MUAYENE VE KABUL KOMİSYONU KARARI', bold: true, size: 28, font: trf })],
      }),
      infoTable,
      new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: `${idare}NE`, bold: true, size: 22, font: trf })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: kararTarih, size: 20, font: trf })],
      }),
    ];

    const cw = [360, 4400, 520, 520, 900, 1000, 960, 700];
    const headerRow = new TableRow({
      children: [
        thc('SIRA NO'),
        thc('MAL/MALZEMENİN\nADI'),
        thc('MİKTARI'),
        thc('ÖLÇEĞİ'),
        thc('BİRİM FİYATI\n(KDV HARİÇ)'),
        thc('TOPLAM FİYAT\n(KDV HARİÇ)'),
        thc('KABUL EDİLEN\nMİKTAR'),
        thc('KALAN'),
      ],
    });

    let sum = 0;
    const dataRows = items.map((it, idx) => {
      const a = awardByItemId.get(it.id) ?? null;
      const qtyStr = this.fmtFiyatTableQty(it.qty);
      const mal = [it.name, it.spec].filter((x) => String(x ?? '').trim()).join('\n') || '—';
      const n = this.toNum(a?.total);
      if (n != null) sum += n;
      return new TableRow({
        children: [
          tdC(String(idx + 1)),
          tdC(mal),
          tdC(qtyStr),
          tdC(String(it.unit ?? '')),
          tdC(this.fmtAmountCellTr(a?.unitPrice)),
          tdC(this.fmtAmountCellTr(a?.total)),
          tdC(qtyStr),
          tdC('0'),
        ],
      });
    });

    const footRow = new TableRow({
      children: [
        new TableCell({
          columnSpan: 5,
          shading: hdr,
          borders: solid,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 10, after: 10 },
              children: [new TextRun({ text: 'Toplam (KDV Hariç)', bold: true, size: 18, font: trf })],
            }),
          ],
        }),
        tdC(''),
        tdC(this.fmtTry(sum)),
        tdC(''),
      ],
    });

    const mainTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: cw,
      borders: solid,
      rows: [headerRow, ...dataRows, footRow],
    });

    const blocks =
      commissionBlocks.length > 0
        ? commissionBlocks
        : [
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
            { role: 'Komisyon Üyesi', name: '…………………', title: '' },
          ];
    const signTableRows: TableRow[] = [];
    for (let i = 0; i < blocks.length; i += 3) {
      const chunk = blocks.slice(i, i + 3);
      const pad = [...chunk];
      while (pad.length < 3) pad.push({ role: 'Komisyon Üyesi', name: '…………………', title: '' });
      signTableRows.push(
        new TableRow({
          children: pad.map(
            (b) =>
              new TableCell({
                borders: solid,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 24, after: 0 },
                    children: [new TextRun({ text: (b.role ?? '').trim() || 'Komisyon Üyesi', size: 16, font: trf })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 0 },
                    children: [
                      new TextRun({
                        text: this.dtCommissionSignNameUpper(b.name),
                        bold: true,
                        size: 18,
                        font: trf,
                      }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 24 },
                    children: [new TextRun({ text: (b.title ?? '').trim() || '\u00a0', size: 16, font: trf })],
                  }),
                ],
              }),
          ),
        }),
      );
    }
    const signTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [3120, 3120, 3120],
      borders: solid,
      rows: signTableRows,
    });

    const tail: (Paragraph | Table)[] = [
      new Paragraph({ spacing: { before: 50, after: 50 }, children: [new TextRun({ text: ' ', size: 4 })] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80, line: 240 },
        children: [
          new TextRun({
            text: `İhale yetkilisince görevlendirilmemiz nedeniyle ${file.subject} işine ait yukarıda cinsi, miktarı ve tutarı belirtilen emtialar kontrolü yapılmış, alınmasında herhangi bir sakınca bulunmadığı tarafımızdan tesbit edilerek teslim alınmış ve iş bu karar tanzim ve imza edilmiştir.`,
            size: 20,
            font: trf,
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 4 })] }),
      signTable,
    ];

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
              margin: {
                top: convertInchesToTwip(0.35),
                right: convertInchesToTwip(0.45),
                bottom: convertInchesToTwip(0.35),
                left: convertInchesToTwip(0.5),
              },
            },
          },
          children: [...letterhead, headGap, ...corr, ...titleBlock, mainTable, ...tail],
        },
      ],
    });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  private async formatDtBudgetTertibiChain(schoolId: string, accountId: string | null | undefined): Promise<string> {
    if (!accountId) return '……………………………';
    const chain: DtBudgetAccount[] = [];
    let curId: string | null = accountId;
    for (let i = 0; i < 24 && curId; i++) {
      const row = await this.budgetRepo.findOne({ where: { id: curId, schoolId } });
      if (!row) break;
      chain.unshift(row);
      curId = row.parentId ?? null;
    }
    if (!chain.length) return '……………………………';
    const codes = chain.map((r) => (r.code ?? '').trim()).filter(Boolean);
    if (codes.length) return codes.join('.');
    const leaf = chain[chain.length - 1];
    return (leaf?.label ?? '').trim() || '……………………………';
  }

  private async buildHarcamaTalimatiDocx(input: {
    school: Pick<School, 'name' | 'principalName'> | null;
    file: DtFile;
    items: DtItem[];
    letterhead: Paragraph[];
  }): Promise<Buffer> {
    const { school, file, items, letterhead } = input;
    const settings = await this.procurementSettingsRepo.findOne({ where: { schoolId: file.schoolId } });
    const regRows = await this.registryRepo.find({ where: { schoolId: file.schoolId, dtFileId: file.id } });
    const byStage = new Map(regRows.map((r) => [r.stage, r] as const));
    const rIh = byStage.get('ihtiyac_listesi');
    const sayiStr = this.registrySayi(rIh);
    const tarihIh = this.fmtTrDate(rIh?.docDate ?? null) || this.fmtTrDate(new Date());
    const tarihOlur =
      this.fmtTrDate(byStage.get('komisyon_onay')?.docDate ?? rIh?.docDate ?? null) || this.fmtTrDate(new Date());
    const tertibi = await this.formatDtBudgetTertibiChain(file.schoolId, file.budgetAccountId);
    let acc: DtBudgetAccount | null = null;
    if (file.budgetAccountId) {
      acc = await this.budgetRepo.findOne({ where: { id: file.budgetAccountId, schoolId: file.schoolId } });
    }
    const alloc = this.toNum(acc?.allocated);
    const blk = this.toNum(acc?.blocked);
    const kullanilabilir =
      alloc != null && blk != null && Number.isFinite(alloc - blk) ? this.fmtTry(Math.max(0, alloc - blk)) : '……………………………';
    const approxStr = this.fmtTry(file.approxTotal) || '…………………';
    const hukuki = "4734 Sayılı Kamu İhale Kanunu'nun 22/d Maddesi";
    const birimAd = `${((school?.name ?? '').trim() || 'Kurum').toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜ`;
    const raName = (settings?.realizationAuthorityName ?? '').trim() || '…………………';
    const raTitle = (settings?.realizationAuthorityTitle ?? '').trim() || '…………………';
    const spName = (settings?.spendingAuthorityName ?? school?.principalName ?? '').trim() || '…………………';
    const spTitle = (settings?.spendingAuthorityTitle ?? '').trim() || 'Müdür';

    const tr = 'Times New Roman';
    const solid = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    } as const;
    const noneTbl = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    } as const;
    const lbl = (t: string) =>
      new TableCell({
        borders: solid,
        shading: { fill: 'E8EEF5' } as any,
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 20, font: tr })] })],
      });
    const val = (t: string, opts?: { center?: boolean }) =>
      new TableCell({
        borders: solid,
        children: [
          new Paragraph({
            alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: t || '\u00a0', size: 20, font: tr })],
          }),
        ],
      });
    const emptyCell = () =>
      new TableCell({
        borders: solid,
        children: [new Paragraph({ children: [new TextRun({ text: '\u00a0', size: 8, font: tr })] })],
      });

    const ekRow = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [7000, 2360],
      borders: noneTbl,
      rows: [
        new TableRow({
          children: [
            new TableCell({ borders: noneTbl, children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 4 })] })] }),
            new TableCell({
              borders: noneTbl,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: 'Ek-1', bold: true, size: 22, font: tr })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const titleP = new Paragraph({
      spacing: { before: 120, after: 200 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'HARCAMA TALİMATI',
          bold: true,
          size: 32,
          font: tr,
          underline: { type: UnderlineType.SINGLE },
        }),
      ],
    });

    const infoTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [4680, 4680],
      borders: solid,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: solid,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: sayiStr ? `Sayı: ${sayiStr}` : 'Sayı: ……………………………', size: 20, font: tr })],
                }),
              ],
            }),
            new TableCell({
              borders: solid,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `Tarih: ${tarihIh}`, size: 20, font: tr })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              borders: solid,
              children: [
                new Paragraph({
                  spacing: { before: 80 },
                  children: [
                    new TextRun({ text: 'Harcama talebinde bulunan birim:', bold: true, size: 20, font: tr }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              borders: solid,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60, after: 80 },
                  children: [new TextRun({ text: birimAd, bold: true, size: 22, font: tr })],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const rowSpecs: { label: string; value: string }[] = [
      { label: 'Gerekçesi ve Hukuki Dayanağı', value: hukuki },
      { label: "Konusu/nev'i / Niteliği", value: (file.subject ?? '').trim() || '—' },
      { label: 'Miktarı', value: `${items.length} Kalem` },
      { label: 'Gerçekleştirme Süresi', value: '………… Gün' },
      { label: 'Gerçekleştirme Usulü', value: hukuki },
      { label: 'Yaklaşık Maliyet', value: approxStr },
      { label: 'Kullanılabilir Ödenek Tutarı', value: kullanilabilir },
      { label: 'Ödeneğin Bütçe Tertibi', value: tertibi },
      { label: 'Gerçekleştirme Görevlileri', value: `${raName}\n${raTitle}` },
      { label: '', value: '' },
    ];

    const mainRows: TableRow[] = rowSpecs.map((spec, i) => {
      const vCell =
        i === 0
          ? new TableCell({
              borders: solid,
              verticalMerge: VerticalMergeType.RESTART,
              textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 40, right: 40 } as any,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'YAPILACAK HARCAMANIN', bold: true, size: 20, font: tr })],
                }),
              ],
            })
          : new TableCell({
              borders: solid,
              verticalMerge: VerticalMergeType.CONTINUE,
              children: [new Paragraph({ children: [new TextRun({ text: '\u00a0', size: 4, font: tr })] })],
            });
      return new TableRow({
        children: [
          vCell,
          spec.label.trim() ? lbl(spec.label) : emptyCell(),
          spec.label.trim() ? val(spec.value) : emptyCell(),
        ],
      });
    });

    const mainTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: [720, 3240, 5400],
      borders: solid,
      rows: mainRows,
    });

    const acikTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: solid,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: solid,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'AÇIKLAMALAR:', bold: true, size: 20, font: tr })],
                }),
                new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: '\u00a0', size: 20, font: tr })] }),
                new Paragraph({ children: [new TextRun({ text: '\u00a0', size: 20, font: tr })] }),
              ],
            }),
          ],
        }),
      ],
    });

    const signRow = new TableRow({
      children: [
        new TableCell({
          borders: solid,
          margins: { top: 120, bottom: 120, left: 120, right: 120 } as any,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Yukarıda belirtilen hizmetin/ işin alımının gerçekleştirilmesi uygundur',
                  size: 20,
                  font: tr,
                }),
              ],
            }),
            new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Teklif Eden Yetkilinin', size: 18, font: tr })] }),
            new Paragraph({ spacing: { before: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: raName, bold: true, size: 22, font: tr })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: raTitle, size: 20, font: tr })] }),
          ],
        }),
        new TableCell({
          borders: solid,
          margins: { top: 120, bottom: 120, left: 120, right: 120 } as any,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [new TextRun({ text: 'O  L  U  R', bold: true, size: 26, font: tr })],
            }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tarihOlur, size: 20, font: tr })] }),
            new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Harcama Yetkilisi*', size: 18, font: tr })] }),
            new Paragraph({ spacing: { before: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: spName, bold: true, size: 22, font: tr })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: spTitle, size: 20, font: tr })] }),
          ],
        }),
      ],
    });
    const signTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [4680, 4680],
      borders: solid,
      rows: [signRow],
    });

    const footP = new Paragraph({
      spacing: { before: 160 },
      children: [
        new TextRun({
          text:
            '*Bu sütun, yönetim kurulu, komisyon veya komite kararlarıyla yapılan harcamalarda kurul, komisyon, komite üyelerinin imzalarını kapsayacak şekilde düzenlenecektir.',
          size: 18,
          font: tr,
          color: 'CC0000',
        }),
      ],
    });

    const body: (Paragraph | Table)[] = [
      ...letterhead,
      ekRow,
      titleP,
      new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
      infoTable,
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      mainTable,
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      acikTable,
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      signTable,
      footP,
    ];

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [{ properties: {}, children: body }],
    });
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
    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'komisyon_onay');
    const header = [
      ...letterhead,
      ...corr,
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

    const doc = new DocxDocument({ styles: this.dtDocxDefaultStyles() as any, sections: [{ properties: {}, children: [...header, table, ...footer] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  /** Malzeme listesi (Teklif Edilen KDV Hariç kolonları) — fiyat araştırması ve teklif mektubu DOCX. */
  private buildDtDocxMalzemeKdvHaricListesiTable(items: DtItem[], trFont: string): Table {
    const solidTbl = {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
    } as const;
    const th = (t: string) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18, font: trFont })] })],
        shading: { fill: 'E8E8E8' } as any,
      });
    const td = (t: string) =>
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 18, font: trFont })] })] });
    const cw = [585, 2160, 2160, 765, 765, 1305, 1260];
    const tSub = () =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: '\u00a0', size: 10, font: trFont })] })],
      });
    const subHdr = new TableRow({
      children: [
        ...Array.from({ length: 5 }, () => tSub()),
        new TableCell({
          columnSpan: 2,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: 'Teklif Edilen KDV Hariç', size: 18, font: trFont })],
            }),
          ],
        }),
      ],
    });
    const malRows: TableRow[] = [
      subHdr,
      new TableRow({
        children: [th('S.No'), th('Malzemenin Adı'), th('Özelliği'), th('Miktarı'), th('Ölçeği'), th('Birim Fiyatı'), th('Tutarı')],
      }),
      ...items.map((it, idx) =>
        new TableRow({
          children: [
            td(String(idx + 1)),
            td(String(it.name ?? '')),
            td(String(it.spec ?? '')),
            td(this.fmtFiyatTableQty(it.qty)),
            td(String(it.unit ?? '')),
            td(''),
            td(''),
          ],
        }),
      ),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 18 })] })],
          }),
          new TableCell({
            columnSpan: 2,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: 'KDV Hariç Teklif Edilen Fiyat:', bold: true, size: 18, font: trFont })],
              }),
            ],
          }),
        ],
      }),
    ];
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: cw,
      borders: solidTbl,
      rows: malRows,
    });
  }

  /** DİĞER ŞARTLAR + imza alanı (DOCX) — fiyat araştırması ve teklif mektubu. */
  private buildDtDocxDigerSartlarImzaBottom(trFont: string): Table {
    const none = {
      style: BorderStyle.NONE,
      size: 0,
      color: 'FFFFFF',
    } as const;
    const noneTbl = {
      top: none,
      bottom: none,
      left: none,
      right: none,
      insideHorizontal: none,
      insideVertical: none,
    } as any;
    const dotted = { style: BorderStyle.DOTTED, size: 4, color: '000000' };
    const dottedTbl = {
      top: dotted,
      bottom: dotted,
      left: dotted,
      right: dotted,
      insideHorizontal: dotted,
      insideVertical: dotted,
    } as const;
    const cellNone = { top: none, bottom: none, left: none, right: none } as any;

    const digerRows = this.dtFiyatArastirmaDigerSartRows().map(
      ({ label: lb, value: val }) =>
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: 'E8E8E8' } as any,
              children: [new Paragraph({ children: [new TextRun({ text: lb, size: 18, font: trFont })] })],
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: val || '\u00a0', size: 18, font: trFont })] }),
              ],
            }),
          ],
        }),
    );
    const digerNested = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [2106, 2574],
      borders: dottedTbl,
      rows: digerRows,
    });

    const line = () =>
      new Paragraph({
        children: [new TextRun({ text: '…………………………………………………………………………………………………………', size: 18, font: trFont })],
      });

    const bottomRow = new TableRow({
      children: [
        new TableCell({
          borders: cellNone,
          children: [
            new Paragraph({ children: [new TextRun({ text: 'DİĞER ŞARTLAR', bold: true, size: 18, font: trFont })] }),
            new Paragraph({ children: [new TextRun({ text: ' ', size: 6 })] }),
            digerNested,
          ],
        }),
        new TableCell({
          borders: cellNone,
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Tarih:', size: 18, font: trFont })] }),
            line(),
            line(),
            line(),
            line(),
            new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Adı Soyadı, Ticaret Ünvanı, İmza, Kaşe veya Açık Adres, Tel. No',
                  size: 16,
                  font: trFont,
                }),
              ],
            }),
            new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
            line(),
            line(),
            line(),
            line(),
          ],
        }),
      ],
    });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [4500, 4500],
      borders: noneTbl,
      rows: [bottomRow],
    });
  }

  private async buildFiyatArastirmasiDocx(input: {
    file: DtFile;
    items: DtItem[];
    vendor: DtVendor;
    letterhead: Paragraph[];
    blocks: Array<{ name: string; title?: string; role?: string }>;
  }): Promise<Buffer> {
    const { file, items, vendor, letterhead, blocks } = input;
    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'fiyat_arastirma', {
      konuText: 'Fiyat Araştırması',
    });

    const padded = [...blocks];
    while (padded.length < 3) padded.push({ name: '…………………', title: '', role: '' });
    const slice = padded.slice(0, 3);

    const none = {
      style: BorderStyle.NONE,
      size: 0,
      color: 'FFFFFF',
    } as const;
    const noneTbl = {
      top: none,
      bottom: none,
      left: none,
      right: none,
      insideHorizontal: none,
      insideVertical: none,
    } as any;
    const cellNone = { top: none, bottom: none, left: none, right: none } as any;

    const trFont = 'Times New Roman';
    const header: any[] = [
      ...letterhead,
      ...corr,
      new Paragraph({
        children: [new TextRun({ text: 'İLGİLİ KİŞİ/FİRMA', bold: true, size: 22, font: trFont })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
      new Paragraph({
        children: [new TextRun({ text: vendor.title, bold: true, size: 20, font: trFont })],
        alignment: AlignmentType.CENTER,
      }),
      ...(vendor.address?.trim()
        ? [
            new Paragraph({
              children: [new TextRun({ text: vendor.address.trim(), size: 18, font: trFont })],
              alignment: AlignmentType.CENTER,
            }),
          ]
        : []),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: `${file.subject} işine ait aşağıda cinsi, özellikleri ve miktarları yazılı mallar / hizmetler 4734 sayılı Kamu İhale Kanunu'nun 22/d Maddesi gereğince Doğrudan Temin Usulüyle satın alınacağından yaklaşık maliyetin tespiti için piyasa araştırması yapılmaktadır, birim fiyatının ve tutarının KDV hariç bildirmenizi rica ederim/ederiz.`,
            size: 18,
            font: trFont,
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
    ];

    const commCells = slice.map(
      (b) =>
        new TableCell({
          borders: cellNone,
          children: [
            new Paragraph({
              children: [new TextRun({ text: (b.role ?? '').trim() || 'Komisyon Üyesi', size: 18, font: trFont })],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: this.dtCommissionSignNameUpper((b.name ?? '…………………').trim() || '…………………'),
                  bold: true,
                  size: 20,
                  font: trFont,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            ...(b.title?.trim()
              ? [
                  new Paragraph({
                    children: [new TextRun({ text: b.title.trim(), size: 18, font: trFont })],
                    alignment: AlignmentType.CENTER,
                  }),
                ]
              : []),
          ],
        }),
    );
    const commTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [3000, 3000, 3000],
      borders: noneTbl,
      rows: [new TableRow({ children: commCells })],
    });

    header.push(commTable as any);
    header.push(new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }));
    header.push(
      new Paragraph({
        children: [new TextRun({ text: 'SATIN ALINACAK MAL/MALZEME LİSTESİ', bold: true, size: 22, font: trFont })],
        alignment: AlignmentType.CENTER,
      }),
    );
    header.push(new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }));

    const malTable = this.buildDtDocxMalzemeKdvHaricListesiTable(items, trFont);
    const bottomTable = this.buildDtDocxDigerSartlarImzaBottom(trFont);

    const footer: any[] = [
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'Yukarıda ismi belirtilen mal/malzemenin birim ve toplam fiyatı günün şartlarına göre belirlenmiş olup belirtilen fiyatlar üzerinden vermeyi teklif ediyorum. Arz olunur.',
            size: 18,
            font: trFont,
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 12 })] }),
      bottomTable as any,
    ];

    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [{ properties: {}, children: [...header, malTable, ...footer] as any }],
    });
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
    const trFont = 'Times New Roman';
    const introTeklif =
      `İdaremiz tarafından ${file.subject} işine ait aşağıda cinsi, özellikleri ve miktarları yazılı mallar / hizmetler 4734 sayılı Kamu İhale Kanunu'nun 22/d maddesi gereğince doğrudan temin usulüyle satın alınacaktır. İlgilenmeniz halinde; teklifin KDV hariç sunulması, teklif edilen toplam bedelin rakam ve yazıyla birbirine uygun yazılması, üzerinde kazıntı, silinti ve düzeltme bulunmaması, teklif mektubunun adı soyadı ve ticaret ünvanı yazılmak suretiyle kaşelenmesi ve imzalanması zorunludur; bu şartları taşımayan teklifler değerlendirmeye alınmayacaktır.`;
    const taahhutTeklif =
      `Yukarıda belirtilen ve İdarenizce satın alınacak olan malların / hizmetlerin cinsi, özellikleri, miktarı ve diğer şartlarını okudum. KDV hariç teklif edilen toplam bedel (para birimi belirtilerek rakam ve yazı ile yazılacaktır) ……………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………………… bedelle vermeyi kabul ve taahhüt ediyorum / ediyoruz.`;

    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'teklif_mektubu');
    const header: any[] = [
      ...letterhead,
      ...corr,
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'TEKLİF MEKTUBU',
            bold: true,
            size: 22,
            font: trFont,
            underline: { type: UnderlineType.SINGLE, color: '000000' },
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: introTeklif, size: 18, font: trFont })],
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({ children: [new TextRun({ text: 'Teklif Sahibinin', bold: true, size: 18, font: trFont })] }),
      new Paragraph({ children: [new TextRun({ text: `Adı Soyadı/Ticaret Unvanı, Uyruğu : ${vendor.title}`, size: 18, font: trFont })] }),
      new Paragraph({ children: [new TextRun({ text: `Açık Tebligat Adresi : ${vendor.address ?? ''}`, size: 18, font: trFont })] }),
      new Paragraph({
        children: [new TextRun({ text: `Bağlı Olduğu Vergi Dairesi ve Vergi Numarası : ${vendor.taxNo ?? ''}`, size: 18, font: trFont })],
      }),
      new Paragraph({ children: [new TextRun({ text: `Telefon ve Faks Numarası : ${vendor.phone ?? ''}`, size: 18, font: trFont })] }),
      new Paragraph({ children: [new TextRun({ text: `E-Mail Adresi (varsa) : ${vendor.email ?? ''}`, size: 18, font: trFont })] }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({
        children: [new TextRun({ text: 'SATIN ALINACAK MAL/MALZEME LİSTESİ', bold: true, size: 22, font: trFont })],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })] }),
    ];
    const malTable = this.buildDtDocxMalzemeKdvHaricListesiTable(items, trFont);
    const bottomTable = this.buildDtDocxDigerSartlarImzaBottom(trFont);
    const footer: any[] = [
      new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: taahhutTeklif, size: 18, font: trFont })],
      }),
      new Paragraph({ children: [new TextRun({ text: ' ', size: 12 })] }),
      bottomTable as any,
    ];
    const doc = new DocxDocument({
      styles: this.dtDocxDefaultStyles() as any,
      sections: [{ properties: {}, children: [...header, malTable, ...footer] as any }],
    });
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
    const { blocks: corr } = await this.buildDtDocxCorrespondenceHeader(file, 'ihale_onay');
    const header = [
      ...letterhead,
      ...corr,
      new Paragraph({ children: [new TextRun({ text: 'SÖZLEŞME', bold: true, size: 22 })], alignment: AlignmentType.CENTER }),
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
    const doc = new DocxDocument({ styles: this.dtDocxDefaultStyles() as any, sections: [{ properties: {}, children: [...header, table, ...footer] }] });
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

  /** Komisyon üyesi seçimi — `users` modülü kapalı olsa da doğrudan temin ekranında kullanılır. */
  async listCommissionTeacherOptions(schoolId: string) {
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.display_name', 'u.email', 'u.role'])
      .where('u.school_id = :schoolId', { schoolId })
      .andWhere('u.role IN (:...roles)', { roles: [UserRole.teacher, UserRole.school_admin] })
      .andWhere('u.status = :status', { status: UserStatus.active })
      .orderBy('u.display_name', 'ASC', 'NULLS LAST')
      .addOrderBy('u.email', 'ASC')
      .getMany();
    return {
      items: rows.map((u) => ({
        id: u.id,
        display_name: u.display_name,
        email: u.email,
      })),
    };
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

  /** Araştırma teklif kalemlerini teklif/ihale satırına yazar; aynı kalem (dt_item_id) varsa günceller. */
  private async applyResearchQuoteItemsToBidQuote(
    schoolId: string,
    dtFileId: string,
    targetQuoteId: string,
    researchRows: DtQuoteItem[],
  ) {
    if (!researchRows.length) return;
    const itemIds = [...new Set(researchRows.map((x) => x.dtItemId))];
    const fileItems = itemIds.length
      ? await this.itemRepo.find({ where: { schoolId, dtFileId, id: In(itemIds) }, select: ['id', 'qty'] })
      : [];
    const qtyById = new Map(fileItems.map((it) => [it.id, it.qty] as const));

    const existingRows =
      itemIds.length > 0
        ? await this.quoteItemRepo.find({
            where: { schoolId, quoteId: targetQuoteId, dtItemId: In(itemIds) },
            select: ['id', 'dtItemId'],
          })
        : [];
    const existingByItem = new Map(existingRows.map((e) => [e.dtItemId, e.id]));

    await this.quoteItemRepo.save(
      researchRows.map((qi) => {
        const up = this.toNum(qi.unitPrice);
        if (up == null || !Number.isFinite(up)) {
          throw new BadRequestException({
            code: 'DT_INVALID_QUOTE_ITEM_PRICE',
            message: 'Araştırmadan teklife aktarımda geçersiz birim fiyatı.',
          });
        }
        const upStr = this.formatQtyOrAmountNumberForApi(up);
        const qtyN = this.toNum(qtyById.get(qi.dtItemId));
        let totalStr: string | null = null;
        if (qtyN != null && Number.isFinite(qtyN) && Number.isFinite(qtyN * up)) {
          totalStr = this.formatQtyOrAmountNumberForApi(qtyN * up);
        } else {
          const totN = qi.total != null && String(qi.total).trim() !== '' ? this.toNum(qi.total) : null;
          totalStr = totN != null && Number.isFinite(totN) ? this.formatQtyOrAmountNumberForApi(totN) : null;
        }
        const exId = existingByItem.get(qi.dtItemId);
        return this.quoteItemRepo.create({
          ...(exId ? { id: exId } : {}),
          schoolId,
          quoteId: targetQuoteId,
          dtItemId: qi.dtItemId,
          unitPrice: upStr,
          total: totalStr,
        });
      }),
    );
  }

  async copyResearchQuotesToBid(schoolId: string, userId: string, dtFileId: string) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });
    const research = await this.quoteRepo.find({ where: { schoolId, dtFileId, purpose: 'market_research' } });
    let created = 0;
    let merged = 0;
    for (const rq of research) {
      const qis = await this.quoteItemRepo.find({
        where: { schoolId, quoteId: rq.id },
        order: { createdAt: 'ASC' },
      });
      const existsBid = await this.quoteRepo.findOne({
        where: { schoolId, dtFileId, vendorId: rq.vendorId, purpose: 'bid' },
        select: ['id'],
      });
      if (existsBid) {
        if (qis.length) {
          await this.applyResearchQuoteItemsToBidQuote(schoolId, dtFileId, existsBid.id, qis);
          merged += 1;
        }
        continue;
      }
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
      if (qis.length) await this.applyResearchQuoteItemsToBidQuote(schoolId, dtFileId, nq.id, qis);
      created += 1;
    }
    if (created || merged) await this.recalcFileTotalsBestEffort(schoolId, dtFileId);
    return { created, merged, total_research: research.length };
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

  async addCommissionMemberAllKinds(schoolId: string, authUserId: string, dtFileId: string, dto: AddDtCommissionMemberDto) {
    const file = await this.fileRepo.findOne({ where: { id: dtFileId, schoolId }, select: ['id'] });
    if (!file) throw new NotFoundException({ code: 'DT_FILE_NOT_FOUND' });

    const uid = dto.user_id?.trim();
    if (!uid) throw new BadRequestException({ code: 'DT_USER_ID_REQUIRED' });

    let addedKinds = 0;
    for (const kind of DT_COMMISSION_KINDS) {
      let comm = await this.commissionRepo.findOne({ where: { schoolId, dtFileId, kind } });
      if (!comm) {
        comm = await this.commissionRepo.save(
          this.commissionRepo.create({
            schoolId,
            dtFileId,
            kind,
            chairmanUserId: null,
            createdByUserId: authUserId,
          }),
        );
      }
      const existing = await this.commMemberRepo.findOne({ where: { commissionId: comm.id, userId: uid } });
      if (existing) continue;
      await this.commMemberRepo.save(
        this.commMemberRepo.create({
          commissionId: comm.id,
          userId: uid,
          title: dto.title || null,
          dutyLabel: dto.duty_label?.trim() || null,
        }),
      );
      addedKinds += 1;
    }
    return { ok: true, added_kinds: addedKinds };
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

    const doc = new DocxDocument({ styles: this.dtDocxDefaultStyles() as any, sections: [{ properties: {}, children: [...header, table, ...footer] }] });
    return Buffer.from(await Packer.toBuffer(doc));
  }

  async getDashboard(schoolId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();

    const files = await this.fileRepo.find({
      where: { schoolId, year: currentYear } as any,
    });
    const activeFiles = files.filter((f) => !f.archivedAt);

    const activeCount = activeFiles.length;
    const approxTotal = activeFiles.reduce((sum, f) => sum + (this.toNum(f.approxTotal) ?? 0), 0);
    const decisionTotal = activeFiles.reduce((sum, f) => sum + (this.toNum(f.decisionTotal) ?? 0), 0);
    const paymentTotal = activeFiles.reduce((sum, f) => sum + (this.toNum(f.paymentTotal) ?? 0), 0);

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
      stats.approx += this.toNum(f.approxTotal) ?? 0;
      stats.decision += this.toNum(f.decisionTotal) ?? 0;
      stats.payment += this.toNum(f.paymentTotal) ?? 0;
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
    const pid = parentId?.trim() || null;
    const items = await this.budgetRepo.find({
      where: pid ? { schoolId, year, parentId: pid } : ({ schoolId, year, parentId: IsNull() } as any),
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

