import clsx from "clsx";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { Button } from "./ui/Button";

export type RepositoryChatOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly icon: LucideIcon;
};

export function RepositoryChatOptionMenu<T extends string>({
  menuLabel,
  value,
  options,
  onChange,
  disabled
}: {
  menuLabel: string;
  value: T;
  options: readonly RepositoryChatOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={clsx("repository-chat-option-menu", open && "open")} ref={rootRef}>
      <Button
        type="button"
        className="repository-chat-option-trigger"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${menuLabel}: ${selected.label}`}
      >
        <selected.icon size={14} aria-hidden="true" />
        <span className="repository-chat-option-trigger-label">{selected.label}</span>
        <ChevronDown size={12} className="repository-chat-option-chevron" aria-hidden="true" />
      </Button>
      {open ? (
        <div className="repository-chat-option-popover" role="listbox" aria-label={menuLabel}>
          <div className="repository-chat-option-popover-label">{menuLabel}</div>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={clsx("repository-chat-option-item", option.value === value && "selected")}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <option.icon size={14} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
