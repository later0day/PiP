import clsx from "clsx";
import { type JSX, type ReactNode, useRef, useState } from "react";
import styles from "./GlideMenu.module.css";

// GlideMenu — beautifului's signature interaction: a highlight block glides to
// follow whichever [data-glide-item] the pointer is over. Rebuilt from usage
// contract (className, highlightClassName, children). Original ships minified.
interface Highlight {
  top: number;
  height: number;
  opacity: number;
}

export interface GlideMenuProps {
  className?: string;
  highlightClassName?: string;
  children?: ReactNode;
}

export function GlideMenu({ className, highlightClassName, children }: GlideMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [hl, setHl] = useState<Highlight | null>(null);

  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const item = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>("[data-glide-item]") : null;
    const box = ref.current;
    if (!item || !box) return;
    const br = box.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    setHl({ top: ir.top - br.top, height: ir.height, opacity: 1 });
  };

  const leave = () => { setHl((h) => (h ? { ...h, opacity: 0 } : h)); };

  return (
    <div ref={ref} className={clsx(styles.root, className)} onMouseMove={move} onMouseLeave={leave}>
      <span
        aria-hidden
        className={clsx(styles.highlight, highlightClassName)}
        style={{
          top: hl ? hl.top : 0,
          height: hl ? hl.height : 0,
          opacity: hl ? hl.opacity : 0,
        }}
      />
      {children}
    </div>
  );
}
