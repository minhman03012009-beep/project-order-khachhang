"use client";

import { Bike, ChevronRight, History, Moon, Store, Sun } from "lucide-react";
import type { OrderType, PublicSettings, ThemeMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StoreHeader({
  settings,
  trackingCode,
  onOpenTracking,
  historyCount = 0,
  onOpenHistory,
  effectiveMode = "dark",
  onToggleTheme,
}: {
  settings?: PublicSettings | null;
  trackingCode: string | null;
  onOpenTracking: () => void;
  historyCount?: number;
  onOpenHistory?: () => void;
  effectiveMode?: ThemeMode;
  onToggleTheme?: () => void;
}) {
  const showToggle = Boolean(settings?.allow_customer_theme_toggle && onToggleTheme);
  const showHistory = Boolean(historyCount > 0 && onOpenHistory);

  if (!trackingCode && !showToggle && !showHistory) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
      {showHistory && (
        <button
          id="open-history-btn"
          type="button"
          onClick={onOpenHistory}
          className="glass animate-rise flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-surface-hover active:scale-95"
        >
          <History className="size-3.5 text-muted" />
          Đơn của bạn ({historyCount})
        </button>
      )}

      {showToggle && (
        <button
          id="customer-theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label={effectiveMode === "dark" ? "Chuyển nền sáng" : "Chuyển nền tối"}
          title={effectiveMode === "dark" ? "Đổi sang nền sáng" : "Đổi sang nền tối"}
          className="glass animate-rise grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-fg transition hover:bg-surface-hover active:scale-95"
        >
          {effectiveMode === "dark" ? (
            <Sun className="size-3.5 text-amber-400" />
          ) : (
            <Moon className="size-3.5 text-muted" />
          )}
        </button>
      )}

      {trackingCode && (
        <button
          id="open-tracking-btn"
          type="button"
          onClick={onOpenTracking}
          className="glass animate-rise flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-3.5 text-xs font-semibold text-fg transition hover:bg-surface-hover active:scale-95"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-warn" />
          Đơn {trackingCode}
          <ChevronRight className="size-3.5 text-muted" />
        </button>
      )}
    </div>
  );
}

export function ModeSwitch({
  mode,
  onChange,
  tableNumber,
}: {
  mode: OrderType;
  onChange: (m: OrderType) => void;
  tableNumber?: string;
}) {
  const options: { value: OrderType; label: string; icon: typeof Store }[] = [
    { value: "DINE_IN", label: "Tại bàn / Mang đi", icon: Store },
    { value: "DELIVERY", label: "Giao tận nơi", icon: Bike },
  ];
  return (
    <div>
      <div
        role="tablist"
        aria-label="Chọn hình thức đặt món"
        className="glass relative grid grid-cols-2 rounded-[1.4rem] p-1.5"
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-2xl bg-accent shadow-[0_6px_24px_-6px_rgb(var(--app-accent-rgb)/0.45)] transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
            mode === "DELIVERY" && "translate-x-full",
          )}
        />
        {options.map(({ value, label, icon: Icon }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              id={`mode-${value.toLowerCase()}`}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onChange(value)}
              className={cn(
                "relative z-10 flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-2 py-3 text-[13px] font-semibold transition-colors duration-300 sm:text-sm",
                active ? "text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4.5" strokeWidth={2.2} />
              {label}
            </button>
          );
        })}
      </div>
      {mode === "DINE_IN" && tableNumber && (
        <p className="animate-rise mt-2.5 text-center text-xs text-muted">
          📍 Bạn đang ngồi tại <span className="font-semibold text-fg">{tableNumber}</span>
        </p>
      )}
    </div>
  );
}
