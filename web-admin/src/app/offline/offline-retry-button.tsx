'use client';

import { Button } from '@/components/ui/button';

export function OfflineRetryButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
      Yeniden dene
    </Button>
  );
}
