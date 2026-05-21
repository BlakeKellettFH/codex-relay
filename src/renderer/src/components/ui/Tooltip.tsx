import { type ReactElement } from "react";
import clsx from "clsx";

export type TooltipProps = {
  label: string;
  children: ReactElement;
  className?: string;
  placement?: "above" | "below";
};

/**
 * Hover/focus tooltip wrapper. Uses a span so tooltips still work when the child button is disabled.
 */
export function Tooltip({ label, children, className, placement = "below" }: TooltipProps): ReactElement {
  const trimmed = label.trim();
  if (!trimmed) {
    return children;
  }

  return (
    <span
      className={clsx("relay-tooltip", placement === "above" && "relay-tooltip-above", className)}
      data-tooltip={trimmed}
    >
      {children}
    </span>
  );
}
