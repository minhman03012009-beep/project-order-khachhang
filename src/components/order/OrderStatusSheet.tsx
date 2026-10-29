"use client";

import {
  Banknote,
  Bike,
  Check,
  ChefHat,
  CircleCheckBig,
  CircleX,
  Clock,
  Copy,
  Landmark,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { VietQrCard } from "@/components/order/VietQrCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { Order, OrderStatus, PublicSettings } from "@/lib/types";
import { cn, formatVND, itemsTotal, STATUS_LABEL } from "@/lib/utils";

interface OrderStatusSheetProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  customerOrderCount: number | null;
  settings: PublicSettings | null;
  onOrderUpdated: (order: Order) => void;
  onNewOrder: () => void;
}

const DINE_IN_STEPS: { status: OrderStatus; label: string; desc: string; icon: typeof Clock }[] = [
  { status: "PENDING", label: "Chờ xác nhận", desc: "Quán đã nhận đơn của bạn", icon: Clock },
  { status: "COOKING", label: "Đang chế biến", desc: "Bếp đang trộn mì nóng hổi", icon: ChefHat },
  { status: "COMPLETED", label: "Hoàn tất", desc: "Mời bạn thưởng thức ngon miệng!", icon: CircleCheckBig },
];

const DELIVERY_STEPS: { status: OrderStatus; label: string; desc: string; icon: typeof Clock }[] = [
  { status: "PENDING", label: "Chờ xác nhận", desc: "Quán đang kiểm tra đơn", icon: Clock },
  { status: "COOKING", label: "Đang nấu", desc: "Bếp đang trộn mì & đóng hộp", icon: ChefHat },
  { status: "DELIVERING", label: "Đang giao", desc: "Shipper đang trên đường tới bạn", icon: Bike },
  { status: "COMPLETED", label: "Hoàn tất", desc: "Đã giao thành công. Chúc ngon miệng!", icon: CircleCheckBig },
];

export function OrderStatusSheet({
  open,
  onClose,
  order,
  customerOrderCount,
  settings,
  onOrderUpdated,
  onNewOrder,
}: OrderStatusSheetProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const orderId = order?.id ?? null;
  const orderStatus = order?.status ?? null;
  const isTerminal = orderStatus === "COMPLETED" || orderStatus === "CANCELLED";

  const fetchLatest = useCallback(
    async (silent = true) => {
      if (!orderId) return;
      if (!silent) setRefreshing(true);
      try {
        const latest = await api<Order>(`/api/orders/${orderId}`);
        onOrderUpdated({
          ...(order as Order),
          ...latest,
        });
      } catch {
        /* ignore transient network errors while polling */
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [orderId, order, onOrderUpdated],
  );

  // Poll every 4 seconds when sheet is open and order is still active
  useEffect(() => {
    if (!open || !orderId || isTerminal) return;
    const id = setInterval(() => {
      void fetchLatest(true);
    }, 4000);
    return () => clearInterval(id);
  }, [open, orderId, isTerminal, fetchLatest]);

  if (!order) return null;

  const isDelivery = order.order_type === "DELIVERY";
  const steps = isDelivery ? DELIVERY_STEPS : DINE_IN_STEPS;
  const currentStepIdx = Math.max(
    0,
    steps.findIndex((s) => s.status === order.status),
  );
  // If dine-in order gets set to DELIVERING by admin, map it to COOKING/COMPLETED gracefully
  const activeIdx =
    !isDelivery && order.status === "DELIVERING" ? 1 : currentStepIdx;

  const sub = itemsTotal(order.items);
  const createdTime = new Date(order.created_at).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const footer = (
    <div className="flex gap-2.5">
      <button
        type="button"
        onClick={onNewOrder}
        className="btn-ghost flex-1 py-3.5 text-xs sm:text-sm"
      >
        <Plus className="size-4" />
        Đặt thêm đơn mới
      </button>
      <button
        type="button"
        onClick={onClose}
        className="btn-primary flex-1 py-3.5 text-xs sm:text-sm"
      >
        {isTerminal ? "Đóng hóa đơn" : "Ẩn & theo dõi tiếp"}
      </button>
    </div>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Hóa đơn & Tiến độ đơn hàng"
      footer={footer}
      size="lg"
    >
      <div className="space-y-5">
        {/* ---------- Header card with Order Code & Status Badge ---------- */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-transparent p-4 sm:p-5">
          <div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-white/10 blur-3xl" />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium tracking-wider text-white/50 uppercase">
                  Mã đơn hàng
                </span>
                <span className="text-xs text-white/35">• {createdTime}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
                  {order.order_code}
                </p>
                <button
                  type="button"
                  aria-label="Sao chép mã đơn"
                  onClick={() => {
                    void navigator.clipboard?.writeText(order.order_code).then(() => {
                      setCopiedCode(true);
                      toast("Đã sao chép mã đơn");
                      setTimeout(() => setCopiedCode(false), 1500);
                    });
                  }}
                  className="grid size-8 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  {copiedCode ? <Check className="size-4 text-ok" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  order.status === "CANCELLED"
                    ? "border-danger/40 bg-danger/15 text-danger"
                    : order.status === "COMPLETED"
                      ? "border-ok/40 bg-ok/15 text-ok"
                      : "border-warn/40 bg-warn/15 text-warn",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    order.status === "CANCELLED"
                      ? "bg-danger"
                      : order.status === "COMPLETED"
                        ? "bg-ok"
                        : "animate-pulse bg-warn",
                  )}
                />
                {STATUS_LABEL[order.status] ?? order.status}
              </span>

              <button
                type="button"
                aria-label="Làm mới trạng thái"
                onClick={() => void fetchLatest(false)}
                disabled={refreshing}
                className="grid size-8 cursor-pointer place-items-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Order type & Loyalty badge */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1 font-medium text-white/90">
              {isDelivery ? (
                <>
                  <Bike className="size-3.5" /> Giao tận nơi
                </>
              ) : (
                <>
                  <Store className="size-3.5" />{" "}
                  {order.table_number ? `Tại ${order.table_number}` : "Tại bàn / Mang đi"}
                </>
              )}
            </span>

            {order.customer_name && (
              <span className="rounded-xl bg-white/5 px-2.5 py-1 text-white/70">
                👤 {order.customer_name}
              </span>
            )}

            {customerOrderCount != null && customerOrderCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-warn/30 bg-warn/10 px-2.5 py-1 font-semibold text-warn">
                <Sparkles className="size-3" /> Đơn thứ {customerOrderCount} của bạn
              </span>
            )}
          </div>

          {isDelivery && order.delivery_address && (
            <p className="mt-2.5 flex items-start gap-1.5 text-xs text-white/65">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-white/45" />
              <span>
                {order.delivery_address}
                {order.distance_km != null && (
                  <span className="text-white/45"> (~{order.distance_km.toFixed(1)} km)</span>
                )}
              </span>
            </p>
          )}
        </div>

        {/* ---------- Live Progress Tracker ---------- */}
        {order.status === "CANCELLED" ? (
          <div className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            <CircleX className="size-5 shrink-0" />
            <div>
              <p className="font-semibold">Đơn hàng đã bị hủy</p>
              <p className="mt-0.5 text-xs text-danger/80">
                Nếu có nhầm lẫn, vui lòng liên hệ trực tiếp nhân viên quán nhé.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid grid-cols-3 gap-2 sm: flex-row" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const done = idx < activeIdx || order.status === "COMPLETED";
                const current = idx === activeIdx && order.status !== "COMPLETED";
                return (
                  <div key={step.status} className="relative flex flex-col items-center text-center">
                    <div
                      className={cn(
                        "grid size-10 place-items-center rounded-2xl border transition-all duration-300",
                        done
                          ? "border-ok/50 bg-ok text-black shadow-[0_0_20px_-4px_var(--color-ok)]"
                          : current
                            ? "border-white bg-white text-black shadow-[0_0_24px_-4px_rgb(255_255_255/0.7)]"
                            : "border-white/10 bg-white/5 text-white/35",
                      )}
                    >
                      <Icon className="size-4.5" strokeWidth={2.2} />
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-[11px] leading-tight font-semibold sm:text-xs",
                        done || current ? "text-white" : "text-white/40",
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 border-t border-white/10 pt-2.5 text-center text-xs text-white/60">
              {steps[activeIdx]?.desc} · <span className="text-white/40">Tự động cập nhật mỗi 4 giây</span>
            </p>
          </div>
        )}

        {/* ---------- VietQR Payment Section (if VIETQR selected) ---------- */}
        {order.payment_method === "VIETQR" &&
          order.status !== "COMPLETED" &&
          order.status !== "CANCELLED" &&
          settings && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Landmark className="size-4 text-white/70" />
                  Quét mã VietQR để thanh toán
                </h3>
                <span className="text-xs text-white/45">Tự điền sẵn số tiền & nội dung</span>
              </div>
              <VietQrCard
                settings={settings}
                amount={order.total_amount}
                orderCode={order.order_code}
              />
            </section>
          )}

        {/* ---------- Itemized Receipt ---------- */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-white/50 uppercase">
            Chi tiết món đã đặt ({order.items.reduce((s, i) => s + i.quantity, 0)} hộp)
          </h3>
          <ul className="divide-y divide-white/10">
            {order.items.map((item, idx) => (
              <li key={`${item.productId}-${idx}`} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    <span className="mr-1.5 inline-block rounded-md bg-white/10 px-1.5 py-0.5 text-xs tabular-nums">
                      x{item.quantity}
                    </span>
                    {item.productName}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatVND(item.subtotal)}
                  </span>
                </div>
                {item.selectedToppings.length > 0 && (
                  <p className="mt-1 text-xs text-white/55">
                    + Topping:{" "}
                    {item.selectedToppings
                      .map((t) => `${t.name} (x${t.quantity})`)
                      .join(", ")}
                  </p>
                )}
                {(item.quickTags.length > 0 || item.itemNote) && (
                  <p className="mt-0.5 text-xs text-white/45 italic">
                    Ghi chú: {[...item.quickTags, item.itemNote].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {(order.quick_notes.length > 0 || order.custom_note) && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-xs text-white/65">
              <span className="font-semibold text-white/80">Ghi chú đơn: </span>
              {[...order.quick_notes.map((n) => `[${n}]`), order.custom_note]
                .filter(Boolean)
                .join(" — ")}
            </div>
          )}

          <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-sm">
            <div className="flex justify-between text-xs text-white/55">
              <dt>Tạm tính món</dt>
              <dd className="tabular-nums">{formatVND(sub)}</dd>
            </div>
            {isDelivery && (
              <div className="flex justify-between text-xs text-white/55">
                <dt>Phí giao hàng</dt>
                <dd className="tabular-nums">
                  {order.shipping_fee > 0 ? formatVND(order.shipping_fee) : "Miễn phí"}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-xs text-white/55">
              <dt>Phương thức thanh toán</dt>
              <dd className="inline-flex items-center gap-1 font-medium text-white/85">
                {order.payment_method === "VIETQR" ? (
                  <>
                    <Landmark className="size-3.5" /> Chuyển khoản VietQR
                  </>
                ) : (
                  <>
                    <Banknote className="size-3.5" /> Tiền mặt
                  </>
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-white/10 pt-2.5 text-base font-bold">
              <dt>Tổng thu</dt>
              <dd className="text-lg tabular-nums">{formatVND(order.total_amount)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </BottomSheet>
  );
}

