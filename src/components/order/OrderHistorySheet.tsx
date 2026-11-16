"use client";

import { Clock, Eye, RotateCcw } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { OrderHistoryEntry } from "@/lib/store";
import { cn, formatVND, STATUS_LABEL } from "@/lib/utils";

interface OrderHistorySheetProps {
  open: boolean;
  onClose: () => void;
  history: OrderHistoryEntry[];
  unitLabel?: string;
  onTrack: (entry: OrderHistoryEntry) => void;
  onReorder: (entry: OrderHistoryEntry) => void;
}

export function OrderHistorySheet({
  open,
  onClose,
  history,
  unitLabel = "hộp",
  onTrack,
  onReorder,
}: OrderHistorySheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Lịch sử đơn của bạn" size="lg">
      {history.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="mx-auto size-9 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-fg">Chưa có đơn hàng nào</p>
          <p className="mt-1 text-xs text-muted">
            Các đơn bạn đặt trên thiết bị này sẽ được lưu tại đây để theo dõi và đặt lại 1 chạm.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {history.map((entry) => {
            const boxes = entry.items.reduce((s, i) => s + i.quantity, 0);
            const names = entry.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ");
            const timeStr = new Date(entry.createdAt).toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            });
            return (
              <li
                key={entry.id}
                className="rounded-3xl border border-line bg-surface p-4 transition hover:border-line-strong"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-fg tabular-nums">{entry.code}</span>
                    <span className="text-xs text-subtle">{timeStr}</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      entry.status === "COMPLETED"
                        ? "border-ok/40 bg-ok/15 text-ok"
                        : entry.status === "CANCELLED"
                          ? "border-danger/40 bg-danger/15 text-danger"
                          : "border-warn/40 bg-warn/15 text-warn",
                    )}
                  >
                    {STATUS_LABEL[entry.status] ?? entry.status}
                  </span>
                </div>

                <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                  {boxes} {unitLabel} · {names}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-sm font-bold text-fg tabular-nums">
                    {formatVND(entry.total)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onTrack(entry)}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      <Eye className="size-3.5" /> Xem tiến trình
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorder(entry)}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      <RotateCcw className="size-3.5" /> Đặt lại
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}

