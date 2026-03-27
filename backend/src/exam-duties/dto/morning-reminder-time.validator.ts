import { ValidateBy, ValidationOptions } from 'class-validator';

/** Türkiye sabah hatırlatması: 06:00–13:59, HH:mm */
export function IsMorningReminderTime(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isMorningReminderTime',
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'string') return false;
          const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
          if (!m) return false;
          const h = parseInt(m[1], 10);
          const min = parseInt(m[2], 10);
          if (Number.isNaN(h) || Number.isNaN(min) || min < 0 || min > 59) return false;
          const total = h * 60 + min;
          return total >= 6 * 60 && total <= 13 * 60 + 59;
        },
        defaultMessage: () =>
          'pref_exam_day_morning_time 06:00–13:59 arası HH:mm olmalı veya boş olmalı',
      },
    },
    validationOptions,
  );
}
