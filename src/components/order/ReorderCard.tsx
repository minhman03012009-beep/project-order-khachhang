"use client";

import { RotateCcw, X } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { LastOrderSnapshot } from "@/lib/store";
import { formatVND } from "@/lib/utils";

/** 1-click reorder card shown when the previous order is remembered in localStorage. */
export function ReorderCard({
  snapshot,
  onReorder,
  onDismiss,
}: {
  snapshot: LastOrderSnapshot;
  onReorder: () => void;
  onDismiss: () => void;
}) {
  const boxes = snapshot.items.reduce((s, it) => s + it.quantity, 0);
  const names = snapshot.items.map((it) => it.productName).join(", ");
  return (
    <div className="glass animate-rise relative flex items-center gap-3 overflow-hidden rounded-3xl p-2.5 pr-3">
      <div className="pointer-events-none absolute -top-10 -left-10 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex shrink-0 -space-x-4">
        {snapshot.items.slice(0, 2).map((it, i) => (
          <div
            key={it.lineId}
            className="relative size-12 overflow-hidden rounded-2xl border-2 border-ink-900"
            style={{ zIndex: 2 - i }}
          >
            <SmartImage src={it.image_url} alt={it.productName} sizes="48px" />
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="text-[13px] font-semibold">🍜 Đặt lại thực đơn lần trước của bạn</p>
        <p className="truncate text-xs text-white/50">
          {boxes} hộp · {names}
        </p>
        <p className="text-xs font-semibold text-white/80 tabular-nums">Tổng: {formatVND(snapshot.total)}</p>
      </div>
      <button
        id="reorder-btn"
        type="button"
        onClick={onReorder}
        className="btn-primary relative shrink-0 rounded-xl px-3 py-2.5 text-xs"
      >
        <RotateCcw className="size-3.5" />
        Thêm vào giỏ
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Ẩn gợi ý đặt lại"
        className="absolute top-1.5 right-1.5 grid size-6 cursor-pointer place-items-center rounded-full text-white/35 transition hover:bg-white/10 hover:text-white sm:static sm:size-8"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
