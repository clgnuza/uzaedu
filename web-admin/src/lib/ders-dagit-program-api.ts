import { apiFetch } from '@/lib/api';

export type DdProgramRow = {
  id: string;
  name: string | null;
  status: string;
  score: number | null;
  is_favorite?: boolean;
  archived_at?: string | null;
  created_at?: string;
};

export async function listStudioPrograms(
  token: string,
  studioId: string,
  opts?: { includeArchived?: boolean },
): Promise<DdProgramRow[]> {
  const q = opts?.includeArchived ? '?include_archived=1' : '';
  return apiFetch<DdProgramRow[]>(`/ders-dagit/studios/${studioId}/programs${q}`, { token });
}

export async function patchProgramName(
  token: string,
  studioId: string,
  programId: string,
  name: string,
): Promise<DdProgramRow> {
  return apiFetch<DdProgramRow>(`/ders-dagit/studios/${studioId}/programs/${programId}`, {
    token,
    method: 'PATCH',
    body: { name },
  });
}

export async function cloneProgram(token: string, studioId: string, programId: string): Promise<DdProgramRow> {
  return apiFetch<DdProgramRow>(`/ders-dagit/studios/${studioId}/programs/${programId}/clone`, {
    token,
    method: 'POST',
  });
}

export async function archiveProgram(token: string, studioId: string, programId: string): Promise<void> {
  await apiFetch(`/ders-dagit/studios/${studioId}/programs/${programId}/archive`, { token, method: 'POST' });
}

export async function unarchiveProgram(token: string, studioId: string, programId: string): Promise<void> {
  await apiFetch(`/ders-dagit/studios/${studioId}/programs/${programId}/unarchive`, { token, method: 'POST' });
}

export async function deleteProgram(token: string, studioId: string, programId: string): Promise<void> {
  await apiFetch(`/ders-dagit/studios/${studioId}/programs/${programId}`, { token, method: 'DELETE' });
}

export async function setFavoriteProgram(
  token: string,
  studioId: string,
  programId: string,
): Promise<DdProgramRow> {
  return apiFetch<DdProgramRow>(`/ders-dagit/studios/${studioId}/programs/${programId}/favorite`, {
    token,
    method: 'POST',
  });
}
