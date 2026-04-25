import { useEffect, useState } from 'react';

/**
 * Returns a copy of `value` that only updates after `delayMs` of stillness.
 * Use this to throttle expensive effects (network calls, heavy renders) that
 * should react to user input but not on every keystroke.
 *
 * Each new `value` cancels the pending update, so rapid changes only ever
 * resolve the most recent one.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
