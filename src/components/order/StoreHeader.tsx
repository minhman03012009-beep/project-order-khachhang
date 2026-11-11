"use client";

import { Bike, ChevronRight, Store } from "lucide-react";
import type { OrderType, PublicSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StoreHeader({
  trackingCode,
  onOpenTracking,
}: {
  settings?: PublicSettings | null;
  trackingCode: string | null;
  onOpenTracking: () => void;
}) {
  if (!trackingCode) return null;

  return (
    <div className="mb-3 flex justify-end">
      <button
        id="open-tracking-btn"
        type="button"
        onClick={onOpenTracking}
        className="glass animate-rise flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full py-2 pr-2.5 pl-3.5 text-xs font-semibold transition hover:bg-white/10 active:scale-95"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-warn" />
        Đơn {trackingCode}
        <ChevronRight className="size-3.5 text-white/50" />
      </button>
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
            "absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-2xl bg-white shadow-[0_6px_24px_-6px_rgb(255_255_255/0.45)] transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
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
                active ? "text-black" : "text-white/60 hover:text-white",
              )}
            >
              <Icon className="size-4.5" strokeWidth={2.2} />
              {label}
            </button>
          );
        })}
      </div>
      {mode === "DINE_IN" && tableNumber && (
        <p className="animate-rise mt-2.5 text-center text-xs text-white/55">
          📍 Bạn đang ngồi tại <span className="font-semibold text-white">{tableNumber}</span>
        </p>
      )}
    </div>
  );
}
