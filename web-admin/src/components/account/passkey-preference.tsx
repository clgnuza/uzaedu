'use client';

import { PasskeySettingsPanel } from '@/components/account/passkey-settings-panel';
import type { AuthPortal } from '@/lib/webauthn';

export function PasskeyPreference({
  token,
  portal,
  enabled = true,
  onEnabledChange,
  className,
}: {
  token: string | null;
  portal: AuthPortal;
  enabled?: boolean;
  onEnabledChange?: (next: boolean) => void;
  className?: string;
}) {
  return (
    <PasskeySettingsPanel
      token={token}
      portal={portal}
      enabled={enabled}
      onEnabledChange={onEnabledChange ?? (() => {})}
      className={className}
    />
  );
}
