import clsx from "clsx";
import { type JSX, useState } from "react";
import { useStage } from "../../hooks";
import { Button } from "../../primitives";
import { lookup } from "../../lib/lookup";
import styles from "./DiffTable.module.css";

// DiffTable — beautifului. A proposed "menu cleanup" diff that reveals in three
// stages (plain → removals tinted → completed diff), lets you toggle changed
// rows on/off, and applies the edits into a green confirmation pill. Ported
// verbatim from the real source; Tailwind → CSS Modules over DSH bridge vars.

// Staged reveal cadence (ms per step); the hook advances one stage per delay and
// runs past the last step so `stage >= STAGE_DELAYS.length` means "settled".
const STAGE_DELAYS = [180, 260];

interface DiffRow {
  key: string;
  id: string;
  dept: string;
  email: string;
  removed: boolean;
}

const DIFF_ROWS = [
  { key: "rocky", id: "Rocky Road", dept: "Classic", email: "aurora-scoops", removed: true },
  { key: "bubblegum", id: "Bubblegum", dept: "Retro", email: "kumo-creamery", removed: true },
  { key: "mint", id: "Mint Chip", dept: "Classic", email: "maple-orbit", removed: false },
] satisfies DiffRow[];

// department → dot color class (concrete keys; dynamic lookup is cast + defaulted).
// CSS-module members are `string | undefined` under noUncheckedIndexedAccess.
const DOT = {
  Classic: styles.dotClassic,
  Retro: styles.dotRetro,
  Seasonal: styles.dotSeasonal,
} satisfies Record<string, string | undefined>;

function IncludedMark({ included, tone }: { included: boolean; tone: "red" | "green" }): JSX.Element {
  const filled = included ? (tone === "red" ? styles.markRed : styles.markGreen) : styles.markEmpty;
  return (
    <span
      aria-hidden
      className={clsx(styles.mark, filled)}
      style={{ transform: included ? "scale(1)" : "scale(0.92)" }}
    >
      {included ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : null}
    </span>
  );
}

export function DiffTable(): JSX.Element {
  const stage = useStage(STAGE_DELAYS);
  // 0 plain · 1 removals · 2 completed diff
  const tinted = stage >= 1;
  const settled = stage >= 2;
  const [accepted, setAccepted] = useState(false);
  const [edits, setEdits] = useState<Record<string, boolean>>({ rocky: true, bubblegum: true, pistachio: true });

  const isOn = (key: string): boolean => edits[key] ?? false;

  const removals = ["rocky", "bubblegum"].filter((key) => isOn(key)).length;
  const additions = isOn("pistachio") ? 1 : 0;
  const showAdded = settled;

  const toggleEdit = (key: string): void => { setEdits((current) => ({ ...current, [key]: current[key] !== true })); };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.bar}>
          <span className={styles.barTitle}>Proposed menu cleanup</span>
          {settled && !accepted && <span className={styles.barHint}>Click changed rows to toggle</span>}
        </div>

        <table className={styles.table}>
          <colgroup>
            <col className={styles.colFlavor} />
            <col className={styles.colCategory} />
            <col className={styles.colSupplier} />
          </colgroup>
          <thead>
            <tr className={styles.headRow}>
              {["Flavor", "Category", "Supplier"].map((h) => (
                <th key={h} className={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIFF_ROWS.map((row) => {
              const out = row.removed && tinted && isOn(row.key);
              const interactive = row.removed && settled && !accepted;
              const dotClass = lookup(DOT, row.dept) ?? DOT.Classic;
              return (
                <tr
                  key={row.key}
                  tabIndex={interactive ? 0 : undefined}
                  aria-selected={row.removed ? isOn(row.key) : undefined}
                  onClick={interactive ? () => { toggleEdit(row.key); } : undefined}
                  onKeyDown={interactive ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleEdit(row.key);
                    }
                  } : undefined}
                  className={clsx(styles.row, interactive && styles.rowInteractive)}
                  style={{ background: out ? "var(--red-tint)" : undefined }}
                >
                  <td
                    className={styles.flavorCell}
                    style={{ color: out ? "var(--red)" : "var(--ink)" }}
                  >
                    {row.id}
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.chip} style={{ opacity: out ? 0.55 : 1 }}>
                      <span className={clsx(styles.dot, dotClass)} />
                      <span className={styles.dept}>{row.dept}</span>
                    </span>
                  </td>
                  <td
                    className={styles.supplierCell}
                    style={{
                      color: out ? "var(--red)" : "var(--ink-2)",
                      textDecorationLine: out ? "line-through" : "none",
                      textDecorationColor: "color-mix(in srgb, var(--red) 50%, transparent)",
                    }}
                  >
                    <span className={styles.supplierInner}>
                      <span className={styles.truncate}>{row.email}</span>
                      {row.removed && settled && <IncludedMark included={isOn(row.key)} tone="red" />}
                    </span>
                  </td>
                </tr>
              );
            })}
            {/* added row */}
            <tr>
              <td colSpan={3} className={styles.addedTd}>
                <div
                  className={styles.addedGrid}
                  style={{
                    gridTemplateRows: showAdded ? "1fr" : "0fr",
                    opacity: showAdded ? 1 : 0,
                    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                  }}
                >
                  <div className={styles.addedOverflow}>
                    <div
                      role="checkbox"
                      tabIndex={accepted ? -1 : 0}
                      aria-checked={isOn("pistachio")}
                      aria-label="Include adding Pistachio"
                      onClick={accepted ? undefined : () => { toggleEdit("pistachio"); }}
                      onKeyDown={accepted ? undefined : (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleEdit("pistachio");
                        }
                      }}
                      className={clsx(styles.addedRow, !(accepted) && styles.addedInteractive)}
                      style={{ background: isOn("pistachio") ? "var(--green-tint)" : undefined }}
                    >
                      <span className={styles.addedFlavor} style={{ color: isOn("pistachio") ? "var(--green)" : "var(--ink-3)" }}>
                        Pistachio
                      </span>
                      <span className={styles.cell}>
                        <span className={styles.chipSurface}>
                          <span className={clsx(styles.dot, styles.dotGreen)} />
                          <span className={styles.dept}>Seasonal</span>
                        </span>
                      </span>
                      <span className={styles.addedSupplier} style={{ color: isOn("pistachio") ? "var(--green)" : "var(--ink-3)" }}>
                        <span className={styles.supplierInner}>
                          <span className={styles.truncate}>maple-orbit</span>
                          <IncludedMark included={isOn("pistachio")} tone="green" />
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* footer — the summary follows the row-level selection */}
        {settled && (
          <div className={styles.footer}>
            {accepted ? (
              <span className={styles.appliedPill}>
                <span className={styles.appliedCheck}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                {removals + additions} {removals + additions === 1 ? "edit" : "edits"} applied
              </span>
            ) : (
              <>
                <span className={styles.summary}>
                  {removals} {removals === 1 ? "removal" : "removals"} · {additions} {additions === 1 ? "addition" : "additions"}
                </span>
                <span className={styles.footerActions}>
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={removals + additions === 0}
                    onClick={() => {
                      setAccepted(true);
                    }}
                    className={styles.applyBtn}
                  >
                    Apply {removals + additions} {removals + additions === 1 ? "change" : "changes"}
                  </Button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
