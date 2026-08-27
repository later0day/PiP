import { type JSX, Fragment, useEffect, useState } from "react";

// StreamText — a typewriter that reveals `text` one character at a time at
// 18ms/char, calling onProgress each tick and onDone at completion. Rebuilt
// behavior-equivalent from usage (text, onProgress, onDone).
export interface StreamTextProps {
  text: string;
  onProgress?: () => void;
  onDone?: () => void;
}

export function StreamText({ text, onProgress, onDone }: StreamTextProps): JSX.Element {
  const [n, setN] = useState(0);

  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      onProgress?.();
      if (i >= text.length) {
        window.clearInterval(id);
        onDone?.();
      }
    }, 18);
    return () => { window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <Fragment>{(text || "").slice(0, n)}</Fragment>;
}
