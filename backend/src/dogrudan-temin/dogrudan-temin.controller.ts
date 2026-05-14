import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { UserRole } from '../types/enums';
import { DogrudanTeminService } from './dogrudan-temin.service';
import {
  AddDtItemDto,
  BlockDtBudgetDto,
  ReleaseDtBudgetDto,
  AutoAwardDto,
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
  RecordDtPaymentDto,
  UpsertDtAwardItemDto,
  UpsertDtQuoteItemDto,
  CreateDtMaterialCategoryDto,
  CreateDtMaterialLibraryItemDto,
  ListDtMaterialLibraryDto,
  CreateDtAcceptanceCommissionDto,
  AddDtCommissionMemberDto,
  GenerateDtPaymentOrderDto,
  DtDashboardQueryDto,
  GetDtBudgetHierarchyDto,
  ListDtQuotesQueryDto,
  PatchDtSchoolProcurementSettingsDto,
  PutDtDocumentRegistryDto,
  SyncDtCommissionDto,
} from './dto/dt.dto';

@Controller('dogrudan-temin')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('dogrudan_temin')
export class DogrudanTeminController {
  constructor(private readonly svc: DogrudanTeminService) {}

  private sid(p: CurrentUserPayload, q?: string): string {
    if (p.role === UserRole.superadmin || p.role === UserRole.moderator) {
      if (!q?.trim()) throw new BadRequestException({ code: 'SCHOOL_ID' });
      return q.trim();
    }
    if (!p.schoolId) throw new BadRequestException({ code: 'NO_SCHOOL' });
    return p.schoolId;
  }

  @Get('school-settings')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getSchoolProcurementSettings(@CurrentUser() p: CurrentUserPayload, @Query('school_id') sid?: string) {
    return this.svc.getSchoolProcurementSettings(this.sid(p, sid));
  }

  @Patch('school-settings')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  patchSchoolProcurementSettings(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: PatchDtSchoolProcurementSettingsDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.patchSchoolProcurementSettings(this.sid(p, sid), dto);
  }

  @Get('rules')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getDtRules() {
    return this.svc.getDtRules();
  }

  @Get('files')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listFiles(
    @CurrentUser() p: CurrentUserPayload,
    @Query() q: ListDtFilesDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.listFiles(this.sid(p, sid), q);
  }

  @Post('files')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createFile(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateDtFileDto, @Query('school_id') sid?: string) {
    return this.svc.createFile(this.sid(p, sid), p.userId, dto);
  }

  @Get('files/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getFile(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.getFile(this.sid(p, sid), id);
  }

  @Post('files/:id/archive')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  archiveFile(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.archiveFile(this.sid(p, sid), p.userId, id);
  }

  @Post('files/:id/unarchive')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  unarchiveFile(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.unarchiveFile(this.sid(p, sid), p.userId, id);
  }

  @Post('files/:id/copy')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  copyFile(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CopyDtFileDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.copyFile(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('files/:id/payments')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listPayments(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listPayments(this.sid(p, sid), id);
  }

  @Post('files/:id/payments')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  recordPayment(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RecordDtPaymentDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.recordPayment(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('files/:id/items')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listItems(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listItems(this.sid(p, sid), id);
  }

  @Post('files/:id/items')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  addItem(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: AddDtItemDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.addItem(this.sid(p, sid), p.userId, id, dto);
  }

  @Patch('files/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  patchFile(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: PatchDtFileDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.patchFile(this.sid(p, sid), p.userId, id, dto);
  }

  @Patch('items/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  patchItem(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: PatchDtItemDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.patchItem(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('vendors')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listVendors(@CurrentUser() p: CurrentUserPayload, @Query() q: ListDtVendorsDto, @Query('school_id') sid?: string) {
    return this.svc.listVendors(this.sid(p, sid), q);
  }

  @Post('vendors')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createVendor(@CurrentUser() p: CurrentUserPayload, @Body() dto: CreateDtVendorDto, @Query('school_id') sid?: string) {
    return this.svc.createVendor(this.sid(p, sid), p.userId, dto);
  }

  @Get('files/:id/quotes')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listQuotes(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Query() q: ListDtQuotesQueryDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.listQuotes(this.sid(p, sid), id, q.purpose);
  }

  @Post('files/:id/quotes/copy-research-to-bid')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  copyResearchQuotesToBid(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.copyResearchQuotesToBid(this.sid(p, sid), p.userId, id);
  }

  @Post('files/:id/quotes')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createQuote(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateDtQuoteDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.createQuote(this.sid(p, sid), p.userId, id, dto);
  }

  @Post('quotes/:id/items')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  upsertQuoteItem(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpsertDtQuoteItemDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.upsertQuoteItem(this.sid(p, sid), id, dto);
  }

  @Get('quotes/:id/items')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listQuoteItems(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listQuoteItems(this.sid(p, sid), id);
  }

  @Get('budgets')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listBudgets(
    @CurrentUser() p: CurrentUserPayload,
    @Query() q: ListDtBudgetAccountsDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.listBudgetAccounts(this.sid(p, sid), q);
  }

  @Post('budgets')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createBudget(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: CreateDtBudgetAccountDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.createBudgetAccount(this.sid(p, sid), p.userId, dto);
  }

  @Post('files/:id/budget/block')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  blockBudget(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: BlockDtBudgetDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.blockBudget(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('files/:id/budget/blocks')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listBudgetBlocks(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listBudgetBlocks(this.sid(p, sid), id);
  }

  @Post('files/:id/budget/release')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  releaseBudget(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReleaseDtBudgetDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.releaseBudget(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('reports/registry')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  registryReport(@CurrentUser() p: CurrentUserPayload, @Query() q: DtRegistryReportDto, @Query('school_id') sid?: string) {
    return this.svc.registryReport(this.sid(p, sid), q);
  }

  @Get('reports/registry.xlsx')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  registryReportXlsx(
    @CurrentUser() p: CurrentUserPayload,
    @Query() q: DtRegistryReportDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.registryReportXlsx(this.sid(p, sid), q);
  }

  @Get('files/:id/awards')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listAwards(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listAwards(this.sid(p, sid), id);
  }

  @Post('files/:id/awards/auto')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  autoAward(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: AutoAwardDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.autoAward(this.sid(p, sid), p.userId, id, dto);
  }

  @Post('files/:id/awards')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  upsertAwardItem(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpsertDtAwardItemDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.upsertAwardItem(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('files/:id/docs')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listDocs(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listDocs(this.sid(p, sid), id);
  }

  @Get('docs/:id/download')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  downloadDoc(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.getDocDownloadUrl(this.sid(p, sid), id);
  }

  @Post('files/:id/docs/generate')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  generateDocForFile(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: GenerateDtDocDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.generateDocForFile(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('files/:id/document-registry')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listDocumentRegistry(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listDocumentRegistry(this.sid(p, sid), id);
  }

  @Put('files/:id/document-registry')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  putDocumentRegistry(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: PutDtDocumentRegistryDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.putDocumentRegistry(this.sid(p, sid), p.userId, id, dto);
  }

  @Get('materials/categories')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listMaterialCategories(@CurrentUser() p: CurrentUserPayload, @Query('school_id') sid?: string) {
    return this.svc.listMaterialCategories(this.sid(p, sid));
  }

  @Post('materials/categories')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createMaterialCategory(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: CreateDtMaterialCategoryDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.createMaterialCategory(this.sid(p, sid), dto);
  }

  @Get('materials/library')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listMaterialLibrary(
    @CurrentUser() p: CurrentUserPayload,
    @Query() q: ListDtMaterialLibraryDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.listMaterialLibrary(this.sid(p, sid), q);
  }

  @Post('materials/library')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createMaterialLibraryItem(
    @CurrentUser() p: CurrentUserPayload,
    @Body() dto: CreateDtMaterialLibraryItemDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.createMaterialLibraryItem(this.sid(p, sid), p.userId, dto);
  }

  @Get('files/:id/commission')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getAcceptanceCommission(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Query('kind') kind?: string,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.getAcceptanceCommission(this.sid(p, sid), id, kind);
  }

  @Get('files/:id/commissions')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listCommissionsByFile(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') sid?: string) {
    return this.svc.listCommissionsByFile(this.sid(p, sid), id);
  }

  @Post('files/:id/commission')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createAcceptanceCommission(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateDtAcceptanceCommissionDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.createAcceptanceCommission(this.sid(p, sid), p.userId, { ...dto, dt_file_id: id });
  }

  @Post('files/:id/commissions/sync')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  syncCommissionMembers(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: SyncDtCommissionDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.syncCommissionMembers(this.sid(p, sid), p.userId, id, dto);
  }

  @Post('commission/:commissionId/members')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  addCommissionMember(
    @CurrentUser() p: CurrentUserPayload,
    @Param('commissionId') commissionId: string,
    @Body() dto: AddDtCommissionMemberDto,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.addCommissionMember(this.sid(p, sid), commissionId, dto);
  }

  @Delete('commission/members/:memberId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  removeCommissionMember(@CurrentUser() p: CurrentUserPayload, @Param('memberId') memberId: string, @Query('school_id') sid?: string) {
    return this.svc.removeCommissionMember(this.sid(p, sid), memberId);
  }

  @Post('payments/:id/order-pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async generatePaymentOrderPdf(
    @CurrentUser() p: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: GenerateDtPaymentOrderDto,
    @Query('school_id') sid?: string,
  ) {
    const buffer = await this.svc.generatePaymentOrderPdf(this.sid(p, sid), dto.payment_id, id, dto.order_no, dto.notes);
    return { buffer: buffer.toString('base64'), filename: `odeme-emri-${Date.now()}.docx` };
  }

  @Get('dashboard')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getDashboard(@CurrentUser() p: CurrentUserPayload, @Query() q: DtDashboardQueryDto, @Query('school_id') sid?: string) {
    return this.svc.getDashboard(this.sid(p, sid), q.year);
  }

  @Get('budgets/hierarchy')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getBudgetHierarchy(@CurrentUser() p: CurrentUserPayload, @Query() q: GetDtBudgetHierarchyDto, @Query('school_id') sid?: string) {
    return this.svc.getBudgetHierarchy(this.sid(p, sid), q.year || new Date().getFullYear(), q.parent_id);
  }

  @Get('budgets/hierarchy/:parentId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getBudgetHierarchyChildren(
    @CurrentUser() p: CurrentUserPayload,
    @Param('parentId') parentId: string,
    @Query('year') year?: string,
    @Query('school_id') sid?: string,
  ) {
    return this.svc.getBudgetHierarchyChildren(
      this.sid(p, sid),
      Number(year) || new Date().getFullYear(),
      parentId,
    );
  }
}

