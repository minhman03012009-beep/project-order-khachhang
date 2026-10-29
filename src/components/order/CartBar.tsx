"use client";

import { ArrowRight, ShoppingBag } from "lucide-react";
import { formatVND } from "@/lib/utils";

/** Floating glass cart bar pinned to the bottom of the viewport. */
export function CartBar({
  count,
  total,
  onOpen,
  closed,
}: {
  count: number;
  total: number;
  onOpen: () => void;
  closed?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
      <button
        id="cart-bar"
        type="button"
        onClick={onOpen}
        className="glass-strong animate-rise pointer-events-auto mx-auto flex w-full max-w-xl cursor-pointer items-center gap-3 rounded-[1.6rem] p-2 pl-3 text-left shadow-[0_20px_60px_-15px_rgb(0_0_0/0.9)] transition hover:border-white/20 active:scale-[0.99]"
      >
        <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10">
          <ShoppingBag className="size-5" />
          <span
            key={count}
            className="animate-pop absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] leading-5 font-bold text-black"
          >
            {count}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-white/55">Giỏ hàng ({count} món)</span>
          <span key={total} className="animate-rise block text-[17px] font-bold tabular-nums">
            {formatVND(total)}
          </span>
        </span>
        <span className="btn-primary shrink-0 rounded-[1.15rem] px-4 py-3.5 text-[13px] sm:px-5">
          {closed ? "Xem giỏ" : "Tiếp tục đặt hàng"}
          <ArrowRight className="size-4" />
        </span>
      </button>
    </div>
  );
}
