import { type JSX, useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "./ModalSurface.module.css";

// ModalSurface — the shared overlay shell for picker/dialog surfaces (legacy
// ModalSurface.ts, distilled to the behaviors the React tree needs): renders in
// a portal, dims the page, routes Escape + backdrop press to onClose (unless
// busy), moves focus into the dialog on open, traps Tab within it, and restores
// focus on unmount. DSH-skinned via --shadow-overlay + panel radii.

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export interface ModalSurfaceProps {
  onClose: () => void;
  /** While busy, Escape + backdrop don't close (in-flight work owns the key). */
  busy?: boolean;
  /** Selector of the element to focus on open; falls back to the dialog itself. */
  initialFocus?: string;
  label?: string;
  className?: string;
  children: ReactNode;
}

export function ModalSurface({
  onClose,
  busy = false,
  initialFocus,
  label,
  className,
  children,
}: ModalSurfaceProps): JSX.Element {
  const sectionRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<Element | null>(null);

  // Move focus into the dialog on open; restore it on close.
  useEffect(() => {
    previousFocus.current = document.activeElement;
    const section = sectionRef.current;
    if (section !== null) {
      const target = initialFocus !== undefined
        ? section.querySelector<HTMLElement>(initialFocus)
        : null;
      (target ?? section).focus({ preventScroll: true });
    }
    return () => {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus({ preventScroll: true });
      }
    };
  }, [initialFocus]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>): void => {
      if (event.key === "Escape") {
        if (!busy) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const section = sectionRef.current;
      if (section === null) return;
      const focusable = Array.from(section.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    },
    [busy, onClose],
  );

  const onBackdrop = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (event.target === event.currentTarget && !busy) onClose();
    },
    [busy, onClose],
  );

  return createPortal(
    <div className={styles.backdrop} onMouseDown={onBackdrop}>
      <section
        ref={sectionRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={clsx(styles.surface, className)}
        onKeyDown={onKeyDown}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
