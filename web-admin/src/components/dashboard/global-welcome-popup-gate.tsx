'use client';

import { useWelcomeMotivationQuote } from '@/components/dashboard/welcome-motivation-banner';
import { WelcomeZodiacModal } from '@/components/dashboard/welcome-zodiac-modal';

export function GlobalWelcomePopupGate() {
  const q = useWelcomeMotivationQuote();

  if (!q.isTeacherPopup || !q.popupOpen || !q.data?.message) return null;

  return (
    <WelcomeZodiacModal
      open={q.popupOpen}
      onOpenChange={q.handlePopupOpenChange}
      dateKey={q.data.date_key}
      message={q.data.message}
      zodiacKey={q.data.zodiac_key}
    />
  );
}
