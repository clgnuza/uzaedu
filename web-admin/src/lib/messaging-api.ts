import { apiFetch } from './api';

export const MSG_API = '/messaging';

export type Campaign = {
  id: string; type: string; title: string; status: string;
  totalCount: number; sentCount: number; failedCount: number;
  createdAt: string; metadata: Record<string, unknown>;
};

export type Recipient = {
  id: string; campaignId: string; recipientName: string | null;
  phone: string | null; studentName: string | null; studentNumber: string | null;
  className: string | null; messageText: string | null; status: string;
  sentAt: string | null; errorMsg: string | null; sortOrder: number;
};

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

export async function deleteCampaign(token: string, id: string, q: string): Promise<void> {
  await apiFetch(`${MSG_API}/campaigns/${id}${q}`, { method: 'DELETE', token });
}

export async function executeCampaign(token: string, id: string, q: string) {
  return apiFetch<{ started: boolean; total: number }>(`${MSG_API}/campaigns/${id}/execute${q}`, { method: 'POST', token });
}

export async function loadRecipients(token: string, id: string, q: string): Promise<Recipient[]> {
  return apiFetch<Recipient[]>(`${MSG_API}/campaigns/${id}/recipients${q}`, { token });
}
