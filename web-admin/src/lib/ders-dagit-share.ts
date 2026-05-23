import { apiFetch } from '@/lib/api';

export type ProgramShareSection = {
  class_section: string;
  lesson_count: number;
  enabled: boolean;
  path: string | null;
};

export type ProgramShareStatus = {
  share_active: boolean;
  share_token: string | null;
  base_path: string | null;
  settings: { enabled_sections?: string[] | null };
  sections: ProgramShareSection[];
};

export function shareFullUrl(path: string) {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export async function fetchProgramShareStatus(
  token: string,
  studioId: string,
  programId: string,
): Promise<ProgramShareStatus> {
  return apiFetch<ProgramShareStatus>(`/ders-dagit/studios/${studioId}/programs/${programId}/share`, { token });
}

export async function patchProgramShareSections(
  token: string,
  studioId: string,
  programId: string,
  enabled_sections: string[] | null,
): Promise<ProgramShareStatus> {
  return apiFetch<ProgramShareStatus>(`/ders-dagit/studios/${studioId}/programs/${programId}/share`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ enabled_sections }),
  });
}

export async function activateProgramShare(
  token: string,
  studioId: string,
  programId: string,
): Promise<{ share_token: string; path: string }> {
  return apiFetch(`/ders-dagit/studios/${studioId}/programs/${programId}/share`, {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function copySectionShareLink(
  token: string,
  studioId: string,
  programId: string,
  class_section: string,
): Promise<string> {
  const res = await apiFetch<{ path: string }>(`/ders-dagit/studios/${studioId}/programs/${programId}/share`, {
    token,
    method: 'POST',
    body: JSON.stringify({ class_section }),
  });
  const url = shareFullUrl(res.path);
  await navigator.clipboard.writeText(url).catch(() => {});
  return url;
}

export async function revokeProgramShare(token: string, studioId: string, programId: string) {
  await apiFetch(`/ders-dagit/studios/${studioId}/programs/${programId}/share`, { token, method: 'DELETE' });
}
