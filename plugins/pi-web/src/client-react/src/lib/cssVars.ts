import type { CSSProperties } from "react";

/**
 * Build an inline-style object carrying CSS custom properties (`--foo`).
 * `CSSProperties` does not admit `--*` keys, and the lint baseline bans `as`
 * casts, so this helper narrows a plain custom-property record to
 * `CSSProperties` in one sanctioned place. Merge with `{ ...base, ...cssVars(...) }`.
 */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
   
  return vars;
}
