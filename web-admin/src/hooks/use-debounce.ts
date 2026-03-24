'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Debounce a value. Updates `debouncedValue` after `delay` ms of no changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

/**
 * Debounced callback – runs fn after delay ms of no invocations.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const callback = useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      const t = setTimeout(() => {
        fn(...args);
        setTimeoutId(null);
      }, delay);
      setTimeoutId(t);
    }) as T,
    [fn, delay]
  );
  useEffect(
    () => () => {
      if (timeoutId) clearTimeout(timeoutId);
    },
    [timeoutId],
  );
  return callback;
}
