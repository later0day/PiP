import { useEffect, useState } from "react";

/**
 * Advances a stage index once per step, waiting `steps[stage]` ms between
 * transitions, and stops at the last step (stays on `steps.length - 1`).
 * Drives ThinkingState's one-shot trace reveal.
 */
export function useSequence(steps: number[]): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= steps.length - 1) return;
    const t = setTimeout(() => { setStage((s) => s + 1); }, steps[stage]);
    return () => { clearTimeout(t); };
  }, [stage, steps]);
  return stage;
}
