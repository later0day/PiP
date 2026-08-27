import { useEffect, useState } from "react";

/**
 * Elapsed-time ticker: counts in deciseconds, formats as `1.2s` / `1m 3.4s`.
 * Used by LoadingState (and ThinkingState) to show a live "churning" timer.
 */
export function useElapsed(): string {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { setDs((d) => d + 1); }, 100);
    return () => { clearInterval(t); };
  }, []);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${String(Math.floor(total / 60))}m ${(total % 60).toFixed(1)}s`;
}
