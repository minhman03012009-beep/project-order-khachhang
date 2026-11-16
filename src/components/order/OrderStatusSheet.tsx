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
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { VietQrCard } from "@/components/order/VietQrCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { toast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import type { Order, OrderStatus, PublicSettings } from "@/lib/types";
import { cn, formatVND, itemsTotal, STATUS_LABEL } from "@/lib/utils";

interface OrderStatusSheetProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  customerOrderCount: number | null;
  trackingToken?: string;
  settings: PublicSettings | null;
  onOrderUpdated: (order: Order) => void;
  onNewOrder: () => void;
}

const DINE_IN_STEPS: { status: OrderStatus; label: string; desc: string; icon: typeof Clock }[] = [
  { status: "PENDING", label: "Chờ xác nhận", desc: "Quán đã nhận đơn của bạn", icon: Clock },
  { status: "COOKING", label: "Đang chế biến", desc: "Bếp đang chuẩn bị món nóng hổi", icon: ChefHat },
  { status: "COMPLETED", label: "Hoàn tất", desc: "Mời bạn thưởng thức ngon miệng!", icon: CircleCheckBig },
];

const DELIVERY_STEPS: { status: OrderStatus; label: string; desc: string; icon: typeof Clock }[] = [
  { status: "PENDING", label: "Chờ xác nhận", desc: "Quán đang kiểm tra đơn", icon: Clock },
  { status: "COOKING", label: "Đang nấu", desc: "Bếp đang chuẩn bị & đóng gói", icon: ChefHat },
  { status: "DELIVERING", label: "Đang giao", desc: "Shipper đang trên đường tới bạn", icon: Bike },
  { status: "COMPLETED", label: "Hoàn tất", desc: "Đã giao thành công. Chúc ngon miệng!", icon: CircleCheckBig },
];

export function OrderStatusSheet({
  open,
  onClose,
  order,
  customerOrderCount,
  trackingToken,
  settings,
  onOrderUpdated,
  onNewOrder,
}: OrderStatusSheetProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const orderId = order?.id ?? null;
  const orderStatus = order?.status ?? null;
  const isTerminal = orderStatus === "COMPLETED" || orderStatus === "CANCELLED";
  const unitLabel = settings?.item_unit_label || "hộp";
  const hotline = settings?.hotline || "0327469961";

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

  // Countdown timer for VietQR expiration
  const shouldCountdown = Boolean(
    open && order?.expires_at && order.payment_status !== "PAID" && !isTerminal,
  );
  useEffect(() => {
    if (!shouldCountdown || !order?.expires_at) return;
    const expiresMs = new Date(order.expires_at).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [shouldCountdown, order?.expires_at]);

  if (!order) return null;

  const isDelivery = order.order_type === "DELIVERY";
  const steps = isDelivery ? DELIVERY_STEPS : DINE_IN_STEPS;
  const currentStepIdx = Math.max(
    0,
    steps.findIndex((s) => s.status === order.status),
  );
  const activeIdx = !isDelivery && order.status === "DELIVERING" ? 1 : currentStepIdx;

  const sub = itemsTotal(order.items);
  const createdTime = new Date(order.created_at).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isPaid = order.payment_status === "PAID";
  const canSelfCancel = Boolean(
    settings?.customer_cancel_enabled !== false &&
      order.status === "PENDING" &&
      !isPaid,
  );

  const handleSelfCancel = async () => {
    setCancelling(true);
    try {
      const res = await api<{ order: Order }>(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        json: { token: trackingToken || order.tracking_token || "" },
      });
      onOrderUpdated({ ...order, ...res.order });
      setConfirmCancel(false);
      toast("Đã hủy đơn hàng.");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setCancelling(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

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
        <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-surface p-4 sm:p-5">
          <div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-accent/10 blur-3xl" />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium tracking-wider text-muted uppercase">
                  Mã đơn hàng
                </span>
                <span className="text-xs text-subtle">• {createdTime}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-2xl font-extrabold tracking-tight text-fg tabular-nums sm:text-3xl">
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
                  className="grid size-8 cursor-pointer place-items-center rounded-xl border border-line bg-chip text-muted transition hover:text-fg"
                >
                  {copiedCode ? <Check className="size-4 text-ok" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                className="grid size-8 cursor-pointer place-items-center rounded-full border border-line bg-chip text-muted transition hover:text-fg"
              >
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Order type, payment & loyalty badges */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-chip px-2.5 py-1 font-medium text-fg">
              {isDelivery ? (
                <>
                  <Bike className="size-3.5" /> Giao tận nơi
                </>
              ) : order.is_self_pickup ? (
                <>
                  <Store className="size-3.5" /> Ghé quán lấy
                </>
              ) : (
                <>
                  <Store className="size-3.5" />{" "}
                  {order.table_number ? `Tại ${order.table_number}` : "Tại bàn / Mang đi"}
                </>
              )}
            </span>

            {isPaid && (
              <span className="inline-flex items-center gap-1 rounded-xl border border-ok/40 bg-ok/15 px-2.5 py-1 font-semibold text-ok">
                <ShieldCheck className="size-3.5" /> Đã thanh toán
              </span>
            )}

            {order.customer_name && (
              <span className="rounded-xl bg-chip px-2.5 py-1 text-muted">
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
            <p className="mt-2.5 flex items-start gap-1.5 text-xs text-muted">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {order.delivery_address}
                {order.distance_km != null && (
                  <span className="text-subtle"> (~{order.distance_km.toFixed(1)} km)</span>
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
              <p className="mt-0.5 text-xs opacity-85">
                Nếu có nhầm lẫn, vui lòng gọi hotline {hotline} để được hỗ trợ ngay nhé.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-line bg-surface p-4">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
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
                            ? "border-accent bg-accent text-accent-fg shadow-md"
                            : "border-line bg-chip text-subtle",
                      )}
                    >
                      <Icon className="size-4.5" strokeWidth={2.2} />
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-[11px] leading-tight font-semibold sm:text-xs",
                        done || current ? "text-fg" : "text-subtle",
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 border-t border-line pt-2.5 text-center text-xs text-muted">
              {steps[activeIdx]?.desc} · <span className="text-subtle">Tự động cập nhật mỗi 4 giây</span>
            </p>
          </div>
        )}

        {/* ---------- VietQR Payment Section (if VIETQR & unpaid) ---------- */}
        {order.payment_method === "VIETQR" &&
          !isPaid &&
          order.status !== "COMPLETED" &&
          order.status !== "CANCELLED" &&
          settings && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Landmark className="size-4 text-muted" />
                  Quét mã VietQR để thanh toán
                </h3>
                {secondsLeft != null ? (
                  <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-xs font-semibold text-warn tabular-nums">
                    {secondsLeft > 0 ? `Hiệu lực: ${formatCountdown(secondsLeft)}` : "Hết hạn giữ QR"}
                  </span>
                ) : (
                  <span className="text-xs text-subtle">Tự điền sẵn số tiền & nội dung</span>
                )}
              </div>
              <VietQrCard
                settings={settings}
                amount={order.total_amount}
                orderCode={order.order_code}
              />
            </section>
          )}

        {/* ---------- Itemized Receipt ---------- */}
        <section className="rounded-3xl border border-line bg-surface p-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
            Chi tiết món đã đặt ({order.items.reduce((s, i) => s + i.quantity, 0)} {unitLabel})
          </h3>
          <ul className="divide-y divide-line">
            {order.items.map((item, idx) => (
              <li key={`${item.productId}-${idx}`} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2 text-sm text-fg">
                  <span className="font-semibold">
                    <span className="mr-1.5 inline-block rounded-md bg-chip px-1.5 py-0.5 text-xs tabular-nums">
                      x{item.quantity}
                    </span>
                    {item.productName}
                    {item.spicyLevel != null && (
                      <span className="ml-1.5 text-xs font-medium text-danger">
                        (Cấp {item.spicyLevel})
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatVND(item.subtotal)}
                  </span>
                </div>
                {item.selectedToppings.length > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    + Topping:{" "}
                    {item.selectedToppings
                      .map((t) => `${t.name} (x${t.quantity})`)
                      .join(", ")}
                  </p>
                )}
                {(item.quickTags.length > 0 || item.itemNote) && (
                  <p className="mt-0.5 text-xs text-subtle italic">
                    Ghi chú: {[...item.quickTags, item.itemNote].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {(order.quick_notes.length > 0 || order.custom_note) && (
            <div className="mt-3 rounded-2xl border border-line bg-chip p-2.5 text-xs text-muted">
              <span className="font-semibold text-fg">Ghi chú đơn: </span>
              {[...order.quick_notes.map((n) => `[${n}]`), order.custom_note]
                .filter(Boolean)
                .join(" — ")}
            </div>
          )}

          <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between text-xs text-muted">
              <dt>Tạm tính món</dt>
              <dd className="tabular-nums">{formatVND(sub)}</dd>
            </div>
            {isDelivery && (
              <div className="flex justify-between text-xs text-muted">
                <dt>Phí giao hàng</dt>
                <dd className="tabular-nums">
                  {order.shipping_fee > 0 ? formatVND(order.shipping_fee) : "Miễn phí"}
                </dd>
              </div>
            )}
            {(order.discount_amount ?? 0) > 0 && (
              <div className="flex justify-between text-xs font-semibold text-ok">
                <dt>Giảm giá {order.voucher_code ? `(${order.voucher_code})` : ""}</dt>
                <dd className="tabular-nums">-{formatVND(order.discount_amount!)}</dd>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted">
              <dt>Phương thức thanh toán</dt>
              <dd className="inline-flex items-center gap-1 font-medium text-fg">
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
            <div className="flex items-baseline justify-between border-t border-line pt-2.5 text-base font-bold text-fg">
              <dt>Tổng thu</dt>
              <dd className="text-lg tabular-nums">{formatVND(order.total_amount)}</dd>
            </div>
          </dl>
        </section>

        {/* ---------- Support Hotline & Self-Cancel ---------- */}
        <div className="space-y-2.5">
          <a
            href={`tel:${hotline.replace(/\s+/g, "")}`}
            className="btn-ghost w-full py-3 text-xs"
          >
            <Phone className="size-3.5" />
            Gọi nhanh hỗ trợ quán ({hotline})
          </a>

          {canSelfCancel && (
            !confirmCancel ? (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="btn-danger w-full py-2.5 text-xs"
              >
                <CircleX className="size-3.5" /> Hủy đơn hàng này
              </button>
            ) : (
              <div className="rounded-2xl border border-danger/35 bg-danger/10 p-3 text-center">
                <p className="text-xs font-semibold text-danger">
                  Xác nhận hủy đơn {order.order_code}?
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => setConfirmCancel(false)}
                    className="btn-ghost flex-1 py-2 text-xs"
                  >
                    Giữ lại
                  </button>
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => void handleSelfCancel()}
                    className="flex-1 cursor-pointer rounded-2xl bg-danger py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {cancelling ? "Đang hủy…" : "Xác nhận hủy"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
