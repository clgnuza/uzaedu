import type { LucideIcon } from 'lucide-react';

/** Web Admin rolü (AUTHORITY_MATRIX). */
export type WebAdminRole = 'school_admin' | 'superadmin' | 'teacher' | 'moderator';

/** Moderator için modül anahtarları (backend MODERATOR_MODULES ile uyumlu). */
export type ModeratorModuleKey =
  | 'school_reviews'
  | 'school_profiles'
  | 'announcements'
  | 'schools'
  | 'users'
  | 'market_policy'
  | 'modules'
  | 'document_templates'
  | 'extra_lesson_params'
  | 'outcome_sets'
  | 'system_announcements'
  | 'support';

export interface MenuItem {
  title?: string;
  /** Role bazlı başlık (örn. teacher → "Hesabım Ayarlar") */
  titleByRole?: Partial<Record<WebAdminRole, string>>;
  path?: string;
  icon?: LucideIcon;
  /** AUTHORITY_MATRIX – bu sayfaya erişebilecek roller. */
  allowedRoles: WebAdminRole[];
  /** true: giriş yokken de sol menüde göster (ör. /haberler). */
  publicAccess?: boolean;
  /** Moderator için gerekli modül (role=moderator ise moderator_modules içinde olmalı). */
  requiredModule?: ModeratorModuleKey;
  /** Teacher için: okulda bu modül açık olmalı (enabled_modules içinde veya null). */
  requiredSchoolModule?: string;
  children?: MenuItem[];
  /** Grup başlığı (menüde sadece label). */
  heading?: string;
  disabled?: boolean;
  /** Badge göstermek için key (örn. adminMessagesUnread) */
  badgeKey?: string;
  /** Bu roller için alt menü gösterme; tek tıkla `sidebarHubPath` (filter `renderAsHubOnly` üretir). */
  sidebarHubOnlyRoles?: WebAdminRole[];
  /** Hub hedefi (varsayılan filtrede `/hesaplamalar`). */
  sidebarHubPath?: string;
  /** Hub kartında “aktif” sayılacak path önekleri (örn. alt hesap sayfaları). */
  sidebarHubActivePrefixes?: string[];
  /** filterMenuTree çıktısı — tek hub kartı */
  renderAsHubOnly?: boolean;
  hubOnlyPath?: string;
  /** Sol menü grup kartı rengi (yalnızca alt menülü üst öğede). */
  menuGroup?:
    | 'slate'
    | 'amber'
    | 'rose'
    | 'teal'
    | 'orange'
    | 'emerald'
    | 'cyan'
    | 'sky'
    | 'violet'
    | 'zinc'
    | 'indigo'
    | 'fuchsia';
}

export type MenuConfig = MenuItem[];
