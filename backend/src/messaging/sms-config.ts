export type SmsProvider = 'mock' | 'netgsm';

export type SmsIysList = 'BIREYSEL' | 'TACIR';

export interface SmsConfig {
  provider: SmsProvider;
  usercode: string;
  password: string;
  header: string;
  isActive: boolean;
  iys: boolean;
  iysList: SmsIysList;
  encoding: 'TR' | '';
  commercialAck: boolean;
}

export const DEFAULT_SMS_CONFIG: SmsConfig = {
  provider: 'mock',
  usercode: '',
  password: '',
  header: '',
  isActive: false,
  iys: true,
  iysList: 'BIREYSEL',
  encoding: 'TR',
  commercialAck: false,
};

export function parseSmsConfig(extra: Record<string, unknown> | null | undefined): SmsConfig {
  const raw = (extra?.sms ?? {}) as Record<string, unknown>;
  return {
    provider: raw.provider === 'netgsm' ? 'netgsm' : 'mock',
    usercode: String(raw.usercode ?? '').trim(),
    password: String(raw.password ?? ''),
    header: String(raw.header ?? '').trim().slice(0, 11),
    isActive: raw.isActive === true,
    iys: raw.iys !== false,
    iysList: raw.iysList === 'TACIR' ? 'TACIR' : 'BIREYSEL',
    encoding: raw.encoding === 'TR' ? 'TR' : '',
    commercialAck: raw.commercialAck === true,
  };
}

export function smsConfigReady(c: SmsConfig): boolean {
  if (!c.isActive) return false;
  if (c.provider === 'mock') return !!c.header.trim();
  return !!(c.usercode && c.password && c.header.trim());
}

export function mergeSmsIntoExtra(
  extra: Record<string, unknown>,
  incoming: Partial<SmsConfig>,
  previous?: SmsConfig,
): Record<string, unknown> {
  const prev = previous ?? parseSmsConfig(extra);
  const merged: SmsConfig = {
    ...prev,
    ...incoming,
    provider: incoming.provider === 'netgsm' ? 'netgsm' : incoming.provider === 'mock' ? 'mock' : prev.provider,
    iysList: incoming.iysList === 'TACIR' ? 'TACIR' : incoming.iysList === 'BIREYSEL' ? 'BIREYSEL' : prev.iysList,
    encoding: incoming.encoding === 'TR' ? 'TR' : incoming.encoding === '' ? '' : prev.encoding,
  };
  if (incoming.password === '' && prev.password) merged.password = prev.password;
  return { ...extra, sms: merged as unknown as Record<string, unknown> };
}
