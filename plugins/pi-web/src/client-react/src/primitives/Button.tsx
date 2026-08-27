import clsx from "clsx";
import type {JSX, ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

// Ported from beautifului's private Button atom (shipped minified). Behavior
// contract reconstructed from real usage: variant primary|ghost|accent|secondary|
// success, size sm, disabled, className, aria-* passthrough. `primary` is the
// high-emphasis solid button (ink fill, canvas text) the source assigns to the
// lead CTA; `accent` is the brand-blue action. Tailwind utilities from the
// original translated to CSS-Module rules over the DSH --dsw-* vars.
export type ButtonVariant = "primary" | "ghost" | "secondary" | "accent" | "success";
export type ButtonSize = "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "secondary", size = "sm", className, children, type, ...rest }: ButtonProps): JSX.Element {
  return (
    <button
      type={type ?? "button"}
      className={clsx(styles.base, styles[size], styles[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
