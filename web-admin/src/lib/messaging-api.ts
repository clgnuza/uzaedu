import { apiFetch, buildApiUrl, resolveDefaultApiBase } from './api';

export const MSG_API = '/messaging';

export type Campaign = {
  id: string; type: string; title: string; status: string;
  totalCount: number; sentCount: number; failedCount: number;
  createdAt: string; metadata: Record<string, unknown>;
  approvalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  scheduledAt?: string | null;
  sent?: number;
  failed?: number;
  pending?: number;
};

export type Recipient = {
  id: string; campaignId: string; recipientName: string | null;
  phone: string | null; studentName: string | null; studentNumber: string | null;
  className: string | null; messageText: string | null; status: string;
  sentAt: string | null; errorMsg: string | null; sortOrder: number;
  filePath?: string | null;
  hasFile?: boolean;
};

/** Alıcı başına bölünmüş PDF kampanya türleri */
export const PDF_CAMPAIGN_TYPES = new Set([
  'karne',
  'ara_karne',
  'devamsizlik_mektup',
  'mebbis_puantaj',
  'ek_ders_bordro',
  'maas_bordro',
]);

function normalizeRecipient(r: Recipient): Recipient {
  const hasFile = !!(r.filePath && String(r.filePath).trim());
  return { ...r, hasFile };
}

export async function fetchRecipientPdfBlob(
  token: string,
  campaignId: string,
  recipientId: string,
  q: string,
): Promise<Blob> {
  const path = `/messaging/campaigns/${campaignId}/recipient-file/${recipientId}${q}`;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(buildApiUrl(path, resolveDefaultApiBase()), {
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('PDF yüklenemedi');
  return res.blob();
}

export type MessagingChannel = 'whatsapp' | 'sms';

export type SmsSettingsForm = {
  provider: 'mock' | 'netgsm';
  usercode: string;
  password: string;
  header: string;
  isActive: boolean;
  iys: boolean;
  iysList: 'BIREYSEL' | 'TACIR';
  encoding: 'TR' | '';
  commercialAck: boolean;
};

export const DEFAULT_SMS_SETTINGS: SmsSettingsForm = {
  provider: 'netgsm',
  usercode: '',
  password: '',
  header: '',
  isActive: false,
  iys: true,
  iysList: 'BIREYSEL',
  encoding: 'TR',
  commercialAck: false,
};

export function parseSmsFromExtra(extra?: Record<string, unknown> | null): SmsSettingsForm {
  const raw = (extra?.sms ?? {}) as Record<string, unknown>;
  return {
    provider: raw.provider === 'mock' ? 'mock' : 'netgsm',
    usercode: String(raw.usercode ?? ''),
    password: String(raw.password ?? ''),
    header: String(raw.header ?? ''),
    isActive: raw.isActive === true,
    iys: raw.iys !== false,
    iysList: raw.iysList === 'TACIR' ? 'TACIR' : 'BIREYSEL',
    encoding: raw.encoding === 'TR' ? 'TR' : '',
    commercialAck: raw.commercialAck === true,
  };
}

export function msgQ(role: string | undefined, sid: string | null) {
  return (role === 'superadmin' || role === 'moderator') && sid ? `?school_id=${sid}` : '';
}

export const TYPE_LABELS: Record<string, string> = {
  toplu_mesaj: 'Toplu Mesaj',
  ek_ders: 'Ek Ders',
  maas: 'Maaş',
  devamsizlik: 'Günlük Devamsızlık',
  ders_devamsizlik: 'Ders Bazlı Devamsızlık',
  devamsizlik_mektup: 'Devamsızlık Mektubu',
  karne: 'Karne',
  ara_karne: 'Ara Karne',
  izin: 'İzin',
  veli_toplantisi: 'Veli Toplantısı',
  davetiye: 'Davetiye',
  grup_mesaj: 'Grup Mesajı',
  mebbis_puantaj: 'MEBBİS Puantaj',
  ek_ders_bordro: 'KBS Ek Ders Bordro',
  maas_bordro: 'KBS Maaş Bordro',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak', preview: 'Önizleme', sending: 'Gönderiliyor',
  completed: 'Tamamlandı', failed: 'Hatalı', cancelled: 'İptal',
};
export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  preview: 'bg-amber-100 text-amber-700',
  sending: 'bg-blue-100 text-blue-700 animate-pulse',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export async function loadCampaigns(token: string, q: string): Promise<Campaign[]> {
  return apiFetch<Campaign[]>(`${MSG_API}/campaigns${q}`, { token });
}

export async function createManualMessagingCampaign(
  token: string,
  q: string,
  body: { title: string; recipients: Array<{ name: string; phone: string; message: string }> },
): Promise<Campaign> {
  return apiFetch<Campaign>(`${MSG_API}/campaigns/toplu-mesaj/manual${q}`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export async function deleteCampaign(token: string, id: string, q: string): Promise<void> {
  await apiFetch(`${MSG_API}/campaigns/${id}${q}`, { method: 'DELETE', token });
}

export async function executeCampaign(
  token: string,
  id: string,
  q: string,
  body?: { channel?: MessagingChannel; smsHeader?: string },
) {
  return apiFetch<{ started: boolean; total: number; channel: MessagingChannel }>(
    `${MSG_API}/campaigns/${id}/execute${q}`,
    { method: 'POST', token, body: body ? JSON.stringify(body) : undefined },
  );
}

export async function retryFailedCampaign(token: string, id: string, q: string) {
  return apiFetch<{ started: boolean; total: number }>(`${MSG_API}/campaigns/${id}/retry-failed${q}`, { method: 'POST', token });
}

export async function abortCampaignSend(token: string, id: string, q: string) {
  return apiFetch<{ ok: boolean }>(`${MSG_API}/campaigns/${id}/abort-send${q}`, { method: 'POST', token });
}

export async function loadRecipients(token: string, id: string, q: string): Promise<Recipient[]> {
  const rows = await apiFetch<Recipient[]>(`${MSG_API}/campaigns/${id}/recipients${q}`, { token });
  return rows.map(normalizeRecipient);
}

export type DeliveryHint = {
  whatsappReady: boolean;
  smsReady: boolean;
  apiReady: boolean;
  defaultChannel?: 'whatsapp' | 'sms';
};

export type MessagingTemplate = {
  id: string;
  campaignType: string;
  title: string;
  body: string;
  variables: string | null;
  isSystem: boolean;
};

export async function loadCampaignDetail(token: string, id: string, q: string): Promise<Campaign> {
  return apiFetch<Campaign>(`${MSG_API}/campaigns/${id}${q}`, { token });
}

export async function scheduleCampaign(
  token: string,
  id: string,
  q: string,
  body: { at: string; channel?: MessagingChannel; smsHeader?: string },
) {
  return apiFetch<Campaign>(`${MSG_API}/campaigns/${id}/schedule${q}`, { method: 'POST', token, body: JSON.stringify(body) });
}

export async function cancelCampaignSchedule(token: string, id: string, q: string) {
  return apiFetch<Campaign>(`${MSG_API}/campaigns/${id}/schedule${q}`, { method: 'DELETE', token });
}

export async function approveCampaign(token: string, id: string, q: string) {
  return apiFetch<Campaign>(`${MSG_API}/campaigns/${id}/approve${q}`, { method: 'POST', token });
}

export async function rejectCampaign(token: string, id: string, q: string, reason?: string) {
  return apiFetch<Campaign>(`${MSG_API}/campaigns/${id}/reject${q}`, { method: 'POST', token, body: JSON.stringify({ reason }) });
}

export async function loadPendingApprovals(token: string, q: string): Promise<Campaign[]> {
  return apiFetch<Campaign[]>(`${MSG_API}/approvals/pending${q}`, { token });
}

export async function loadMessagingTemplates(token: string, q: string): Promise<MessagingTemplate[]> {
  return apiFetch<MessagingTemplate[]>(`${MSG_API}/templates${q}`, { token });
}

export async function saveMessagingTemplate(
  token: string,
  q: string,
  body: { id?: string; campaignType: string; title: string; body: string; variables?: string },
) {
  return apiFetch<MessagingTemplate>(`${MSG_API}/templates${q}`, { method: 'POST', token, body: JSON.stringify(body) });
}

export async function deleteMessagingTemplate(token: string, id: string, q: string) {
  await apiFetch(`${MSG_API}/templates/${id}${q}`, { method: 'DELETE', token });
}

export function reportsExportUrl(q: string, from?: string, to?: string): string {
  const sp = new URLSearchParams();
  if (q.startsWith('?')) new URLSearchParams(q.slice(1)).forEach((v, k) => sp.set(k, v));
  if (from) sp.set('from', from);
  if (to) sp.set('to', to);
  const qs = sp.toString();
  return `${MSG_API}/reports/export${qs ? `?${qs}` : ''}`;
}

export function campaignExportUrl(id: string, q: string): string {
  return `${MSG_API}/campaigns/${id}/export${q}`;
}

export async function getDeliveryHint(token: string, q: string): Promise<DeliveryHint> {
  return apiFetch<DeliveryHint>(`${MSG_API}/delivery-hint${q}`, { token });
}

export type MessagingReportsOverview = {
  period: { from: string; to: string };
  summary: {
    campaignsTotal: number;
    campaignsCompleted: number;
    campaignsSending: number;
    campaignsPreview: number;
    campaignsFailed: number;
    campaignsCancelled: number;
    total: number;
    sent: number;
    failed: number;
    pending: number;
    skipped: number;
    deliveryRate: number | null;
  };
  byCampaignStatus: Array<{ status: string; count: number }>;
  byType: Array<{
    type: string;
    campaigns: number;
    sent: number;
    failed: number;
    pending: number;
    total: number;
    successRate: number | null;
  }>;
  byChannel: Array<{
    channel: string;
    sent: number;
    failed: number;
    total: number;
    successRate: number | null;
  }>;
  timeline: Array<{ day: string; sent: number; failed: number }>;
  topErrors: Array<{ message: string; count: number }>;
  recentCampaigns: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    pendingCount: number;
    channel: string | null;
    createdAt: string;
    deliveryRate: number | null;
  }>;
};

export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp API',
  sms: 'SMS',
  belirtilmedi: 'Henüz gönderilmedi',
};

export async function fetchMessagingReports(
  token: string,
  q: string,
  params?: { from?: string; to?: string },
): Promise<MessagingReportsOverview> {
  const sp = new URLSearchParams();
  if (q.startsWith('?')) {
    const sid = new URLSearchParams(q.slice(1)).get('school_id');
    if (sid) sp.set('school_id', sid);
  }
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  const qs = sp.toString();
  return apiFetch<MessagingReportsOverview>(`${MSG_API}/reports/overview${qs ? `?${qs}` : ''}`, { token });
}

export type TeacherMessagingPreferences = {
  appendSignature: string;
  openWaInNewTab: boolean;
};

export async function getMyMessagingPreferences(token: string, q: string): Promise<TeacherMessagingPreferences> {
  return apiFetch<TeacherMessagingPreferences>(`${MSG_API}/me/preferences${q}`, { token });
}

export type CommunicationDiary = {
  phone: string;
  outbound: Array<Record<string, unknown>>;
  inbound: Array<{
    id: string;
    phone: string;
    senderName: string | null;
    body: string | null;
    provider: string;
    messageType: string;
    receivedAt: string;
  }>;
  deliveryEvents: Array<{
    id: string;
    status: string;
    provider: string;
    externalMessageId: string | null;
    createdAt: string;
  }>;
  timeline: Array<{ kind: 'outbound' | 'inbound' | 'delivery'; at: string; payload: Record<string, unknown> }>;
};

export async function fetchCommunicationDiary(token: string, q: string, phone: string): Promise<CommunicationDiary> {
  const sp = new URLSearchParams();
  if (q.startsWith('?')) new URLSearchParams(q.slice(1)).forEach((v, k) => sp.set(k, v));
  sp.set('phone', phone);
  return apiFetch<CommunicationDiary>(`${MSG_API}/contacts/diary?${sp}`, { token });
}

export type SchoolAutomationConfig = {
  morningDevamsizlik?: { enabled?: boolean; hour?: number; minute?: number; channel?: MessagingChannel };
  eokulReminder?: { enabled?: boolean; hour?: number };
  weeklyReport?: { enabled?: boolean; dayOfWeek?: number; hour?: number };
  quietHours?: { enabled?: boolean; startHour?: number; endHour?: number };
};

export async function fetchAutomationConfig(token: string, q: string): Promise<SchoolAutomationConfig> {
  return apiFetch(`${MSG_API}/automation/config${q}`, { token });
}

export async function saveAutomationConfig(token: string, q: string, body: SchoolAutomationConfig) {
  return apiFetch<SchoolAutomationConfig>(`${MSG_API}/automation/config${q}`, { method: 'POST', token, body: JSON.stringify(body) });
}

export async function fetchRiskList(token: string, q: string) {
  return apiFetch<{ items: Array<{ kind: string; studentName: string; className: string; phone: string; score: number; detail: string }>; generatedAt: string }>(
    `${MSG_API}/reports/risk${q}`,
    { token },
  );
}

export async function fetchWeeklyPrincipalReport(token: string, q: string) {
  return apiFetch<Record<string, unknown>>(`${MSG_API}/reports/weekly-principal${q}`, { token });
}

export async function fetchB2GOverview(token: string, from?: string, to?: string) {
  const sp = new URLSearchParams();
  if (from) sp.set('from', from);
  if (to) sp.set('to', to);
  const qs = sp.toString();
  return apiFetch<{ schools: Array<{ schoolId: string; schoolName: string; campaigns: number; sent: number; failed: number }> }>(
    `${MSG_API}/reports/b2g${qs ? `?${qs}` : ''}`,
    { token },
  );
}

export async function fetchMissingPhones(token: string, q: string, campaignId?: string) {
  const sp = new URLSearchParams();
  if (q.startsWith('?')) new URLSearchParams(q.slice(1)).forEach((v, k) => sp.set(k, v));
  if (campaignId) sp.set('campaign_id', campaignId);
  const qs = sp.toString();
  return apiFetch<{ missing: unknown[] }>(`${MSG_API}/reports/missing-phones${qs ? `?${qs}` : ''}`, { token });
}

export async function fetchDashboardCounts(token: string, q: string) {
  return apiFetch<{ pendingApprovals: number; unreadInbound: number; riskCount: number }>(`${MSG_API}/dashboard/counts${q}`, { token });
}

export async function fetchVeliDirectory(token: string, q: string, search?: string) {
  const sp = new URLSearchParams();
  if (q.startsWith('?')) new URLSearchParams(q.slice(1)).forEach((v, k) => sp.set(k, v));
  if (search) sp.set('q', search);
  const qs = sp.toString();
  return apiFetch<Array<{ id: string; phone: string; contactName: string | null; studentName: string | null; className: string | null }>>(
    `${MSG_API}/veli-directory${qs ? `?${qs}` : ''}`,
    { token },
  );
}

export async function syncVeliDirectory(token: string, q: string) {
  return apiFetch<{ upserted: number }>(`${MSG_API}/veli-directory/sync${q}`, { method: 'POST', token });
}

export async function replyInboundMessage(token: string, q: string, inboundId: string, note: string) {
  return apiFetch(`${MSG_API}/inbound/${inboundId}/reply${q}`, { method: 'POST', token, body: JSON.stringify({ note }) });
}

export async function fetchRsvpSummary(token: string, q: string, campaignId: string) {
  return apiFetch<{ total: number; yes: number; no: number; pending: number }>(`${MSG_API}/campaigns/${campaignId}/rsvp${q}`, { token });
}

export async function createAcilCampaign(
  token: string,
  q: string,
  body: { title?: string; message: string; recipients: Array<{ name?: string; phone: string }> },
) {
  return apiFetch<Campaign>(`${MSG_API}/campaigns/acil${q}`, { method: 'POST', token, body: JSON.stringify(body) });
}

export async function fetchRecentCommunicationPhones(
  token: string,
  q: string,
): Promise<Array<{ phone: string; lastAt: string }>> {
  return apiFetch(`${MSG_API}/contacts/recent${q}`, { token });
}

export async function patchMyMessagingPreferences(
  token: string,
  q: string,
  body: Partial<Pick<TeacherMessagingPreferences, 'appendSignature' | 'openWaInNewTab'>>,
): Promise<TeacherMessagingPreferences> {
  return apiFetch<TeacherMessagingPreferences>(`${MSG_API}/me/preferences${q}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}
