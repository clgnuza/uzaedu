import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsArray, ValidateNested, Matches, Max, MaxLength, Min, IsObject } from 'class-validator';
import { DtTeminType } from '../enums/dt-temin-type.enum';
import { DT_COMMISSION_KINDS, DT_QUOTE_PURPOSES, DT_REGISTRY_STAGES } from '../dt-workflow.constants';

export class CreateDtFileDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsString()
  @MaxLength(32)
  file_no: string;

  @IsString()
  @MaxLength(512)
  subject: string;

  @IsString()
  @IsIn(Object.values(DtTeminType))
  temin_type: DtTeminType;

  @IsOptional()
  @IsString()
  budget_account_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  procurement_ref?: string | null;
}

export class ListDtFilesDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsString()
  include_archived?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  file_no?: string;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(DtTeminType))
  temin_type?: DtTeminType;
}

export class AddDtItemDto {
  @IsString()
  @MaxLength(512)
  name: string;

  @IsOptional()
  @IsString()
  spec?: string | null;

  @IsOptional()
  @IsString()
  qty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  vat_rate?: number;

  @IsOptional()
  @IsString()
  estimated_unit_price?: string | null;
}

export class PatchDtFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  subject?: string;

  @IsOptional()
  @IsString()
  @Matches(/^22[a-g]$/i)
  temin_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['mal', 'hizmet', 'yapim'])
  scope?: 'mal' | 'hizmet' | 'yapim';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  budget_account_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  procurement_ref?: string | null;
}

export class PatchDtItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  name?: string;

  @IsOptional()
  @IsString()
  spec?: string | null;

  @IsOptional()
  @IsString()
  qty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  vat_rate?: number;

  @IsOptional()
  @IsString()
  estimated_unit_price?: string | null;
}

export class CreateDtVendorDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  tax_no?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  contact_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string | null;
}

export class ListDtVendorsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class CreateDtQuoteDto {
  @IsString()
  vendor_id: string;

  @IsOptional()
  @IsString()
  @IsIn([...DT_QUOTE_PURPOSES])
  purpose?: (typeof DT_QUOTE_PURPOSES)[number];
}

export class ListDtQuotesQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([...DT_QUOTE_PURPOSES])
  purpose?: (typeof DT_QUOTE_PURPOSES)[number];
}

export class UpsertDtQuoteItemDto {
  @IsString()
  dt_item_id: string;

  @IsString()
  unit_price: string;
}

export class AutoAwardDto {
  @IsString()
  @IsIn(['manual', 'per_item_lowest', 'total_lowest_single_vendor'])
  mode: 'manual' | 'per_item_lowest' | 'total_lowest_single_vendor';
}

export class UpsertDtAwardItemDto {
  @IsString()
  dt_item_id: string;

  @IsString()
  vendor_id: string;

  @IsString()
  unit_price: string;
}

const DT_GENERATE_DOC_TYPES = [
  'ihtiyac_listesi',
  'teklif_isteme',
  'karar',
  'sozlesme',
  'komisyon_onay',
  'onay_belgesi',
  'piyasa_arastirma_tutanagi',
  'yaklasik_maliyet_cetveli',
  'muayene_kabul_tutanagi',
] as const;

export class GenerateDtDocDto {
  @IsString()
  @IsIn([...DT_GENERATE_DOC_TYPES])
  doc_type: (typeof DT_GENERATE_DOC_TYPES)[number];

  @IsOptional()
  @IsString()
  vendor_id?: string;
}

export class CopyDtFileDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  target_year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  file_no?: string;
}

export class CreateDtBudgetAccountDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsString()
  parent_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string | null;

  @IsString()
  @MaxLength(255)
  label: string;

  @IsOptional()
  @IsString()
  allocated?: string;
}

export class ListDtBudgetAccountsDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class BlockDtBudgetDto {
  @IsString()
  budget_account_id: string;

  @IsString()
  amount: string;
}

export class ReleaseDtBudgetDto {
  @IsOptional()
  @IsString()
  block_id?: string;
}

export class DtRegistryReportDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  /** Arşivlenmiş dosyaları da dahil et (mutemet yıllık denetim) */
  @IsOptional()
  @IsIn(['0', '1', 'true', 'false', 'yes', 'no'])
  include_archived?: string;
}

export class RecordDtPaymentDto {
  @IsString()
  amount: string;

  @IsOptional()
  @IsString()
  quote_id?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference_no?: string | null;

  @IsOptional()
  @IsString()
  paid_at?: string | null;
}

export class CreateDtMaterialCategoryDto {
  @IsString()
  @MaxLength(256)
  name: string;

  @IsOptional()
  @IsString()
  parent_id?: string | null;
}

export class CreateDtMaterialLibraryItemDto {
  @IsOptional()
  @IsString()
  category_id?: string | null;

  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(512)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  vat_rate?: number;
}

export class ListDtMaterialLibraryDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  search?: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;
}

export class CreateDtAcceptanceCommissionDto {
  @IsString()
  dt_file_id: string;

  @IsOptional()
  @IsString()
  @IsIn([...DT_COMMISSION_KINDS])
  kind?: (typeof DT_COMMISSION_KINDS)[number];

  @IsOptional()
  @IsString()
  chairman_user_id?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionMemberInputDto)
  members?: CommissionMemberInputDto[];
}

export class CommissionMemberInputDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  duty_label?: string | null;
}

export class AddDtCommissionMemberDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  duty_label?: string | null;
}

export class SyncDtCommissionDto {
  @IsString()
  @IsIn([...DT_COMMISSION_KINDS])
  from_kind: (typeof DT_COMMISSION_KINDS)[number];

  @IsArray()
  @IsString({ each: true })
  @IsIn([...DT_COMMISSION_KINDS], { each: true })
  to_kinds: (typeof DT_COMMISSION_KINDS)[number][];
}

export class PatchDtSchoolProcurementSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  header_line2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  header_line3?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  header_line4?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  spending_authority_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  spending_authority_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  realization_authority_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  realization_authority_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  official_correspondence_code?: string | null;
}

export class DtDocumentRegistryEntryDto {
  @IsString()
  @IsIn([...DT_REGISTRY_STAGES])
  stage: (typeof DT_REGISTRY_STAGES)[number];

  @IsOptional()
  @IsString()
  doc_date?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  number_prefix?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  number_suffix?: string | null;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class PutDtDocumentRegistryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DtDocumentRegistryEntryDto)
  entries: DtDocumentRegistryEntryDto[];
}

export class GenerateDtPaymentOrderDto {
  @IsString()
  payment_id: string;

  @IsOptional()
  @IsString()
  order_no?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DtDashboardQueryDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class GetDtBudgetHierarchyDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  parent_id?: string | null;
}
