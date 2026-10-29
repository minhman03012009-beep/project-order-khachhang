"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** true only after hydration — gates UI that depends on localStorage. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  size = "md",
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  size?: "md" | "lg";
  disabled?: boolean;
  id?: string;
}) {
  const lg = size === "lg";
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative shrink-0 cursor-pointer rounded-full border transition-colors duration-300 disabled:opacity-40",
        lg ? "h-9 w-16" : "h-7 w-12",
        checked ? "border-ok/50 bg-ok/90" : "border-white/15 bg-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          lg ? "size-7" : "size-5",
          checked ? (lg ? "left-[calc(100%-1.875rem)]" : "left-[calc(100%-1.375rem)]") : "left-0.5",
        )}
      />
    </button>
  );
}
