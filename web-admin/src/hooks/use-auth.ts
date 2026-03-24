'use client';

import { useAuthContext } from '@/providers/auth-provider';

export type { Me } from '@/providers/auth-provider';

export function useAuth() {
  return useAuthContext();
}
