"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QtyStepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  /** When value === 0, collapse to a single "+" button. */
  collapsible?: boolean;
  label?: string;
}

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 50,
  size = "md",
  collapsible = false,
  label = "số lượng",
}: QtyStepperProps) {
  const btn = size === "sm" ? "size-8 rounded-xl" : "size-10 rounded-2xl";
  const icon = size === "sm" ? "size-3.5" : "size-4";

  if (collapsible && value === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label={`Thêm ${label}`}
        className={cn(
          btn,
          "grid cursor-pointer place-items-center border border-line-strong bg-surface text-fg transition hover:border-accent hover:bg-accent hover:text-accent-fg active:scale-90",
        )}
      >
        <Plus className={icon} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 border border-line bg-surface p-1",
        size === "sm" ? "rounded-2xl" : "rounded-[1.25rem]",
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Giảm ${label}`}
        className={cn(
          btn,
          "grid cursor-pointer place-items-center text-fg/80 transition hover:bg-chip active:scale-90 disabled:opacity-30",
        )}
      >
        <Minus className={icon} />
      </button>
      <span
        key={value}
        className={cn(
          "animate-pop min-w-6 text-center font-semibold tabular-nums",
          size === "sm" ? "text-sm" : "text-base",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Tăng ${label}`}
        className={cn(
          btn,
          "grid cursor-pointer place-items-center bg-accent text-accent-fg transition hover:opacity-90 active:scale-90 disabled:opacity-30",
        )}
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
