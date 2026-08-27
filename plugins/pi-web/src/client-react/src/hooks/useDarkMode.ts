import { useEffect, useState } from "react";

/**
 * Reports whether the DSH dark theme is active. Adapted from beautifului's
 * original (which watched a `.dark` class on <html>) to the DSH model:
 * dark = `data-ds-dark-theme` attribute on <body>. Observes attribute changes
 * so components restyle live when the theme toggles.
 *
 * @public — one of the 5 mandated beautifului hooks; shipped for parity even
 * though landed components currently restyle via CSS vars rather than JS.
 */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => document.body.hasAttribute("data-ds-dark-theme"));

  useEffect(() => {
    const body = document.body;
    const update = () => { setDark(body.hasAttribute("data-ds-dark-theme")); };
    update();
    const observer = new MutationObserver(update);
    observer.observe(body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    return () => { observer.disconnect(); };
  }, []);

  return dark;
}
