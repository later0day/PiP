import { type JSX, useEffect, useRef } from "react";
import clsx from "clsx";
import type { CompletionItem } from "../../state/completionTypes";
import styles from "./AutocompleteMenu.module.css";

// Phase 4b: the completion dropdown for the composer. Ports the legacy
// AutocompleteMenu (Lit) structure verbatim — insertText / detail / description
// rows with a selected highlight, mousedown-to-pick (preventing the textarea
// from losing focus), and scroll-into-view for the selected row.

export interface AutocompleteMenuProps {
  items: CompletionItem[];
  selectedIndex: number;
  onPick: (item: CompletionItem) => void;
}

export function AutocompleteMenu({ items, selectedIndex, onPick }: AutocompleteMenuProps): JSX.Element | null {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) return null;
  return (
    <div className={styles.menu} role="listbox" aria-label="自动补全">
      {items.map((item, index) => (
        <button
          key={`${item.kind}:${item.insertText}`}
          type="button"
          ref={index === selectedIndex ? selectedRef : undefined}
          role="option"
          aria-selected={index === selectedIndex}
          className={clsx(styles.item, index === selectedIndex && styles.selected)}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item);
          }}
        >
          <strong className={styles.insertText}>{item.insertText}</strong>
          <span className={styles.detail}>{item.detail}</span>
          {item.description !== undefined && item.description !== "" && (
            <small className={styles.description}>{item.description}</small>
          )}
        </button>
      ))}
    </div>
  );
}
