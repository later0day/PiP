import { useEffect, useState } from "react";

/**
 * Staged reveal counter: advances one stage per step and runs *past* the last
 * step (stops at `steps.length`, unlike useSequence which caps at length-1), so
 * consumers can gate "all revealed" on `stage >= steps.length`. Drives
 * ContextCards / DiffTable staged reveals.
 */
export function useStage(steps: number[]): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= steps.length) return;
    const t = setTimeout(() => { setStage((s) => s + 1); }, steps[stage]);
    return () => { clearTimeout(t); };
  }, [stage, steps]);
  return stage;
}
