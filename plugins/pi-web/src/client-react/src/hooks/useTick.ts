import { useEffect, useState } from "react";

/**
 * Like useSequence but semantically a repeating "tick" driver: advances a tick
 * index through `intervals`, stopping at the last. Drives ToolChips / TaskRows
 * staggered status progression.
 */
export function useTick(intervals: number[]): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick >= intervals.length - 1) return;
    const t = setTimeout(() => { setTick((x) => x + 1); }, intervals[tick]);
    return () => { clearTimeout(t); };
  }, [tick, intervals]);
  return tick;
}
