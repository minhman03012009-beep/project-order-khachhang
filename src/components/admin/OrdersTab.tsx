"use client";

import {
  Banknote,
  Bell,
  BellOff,
  Bike,
  ChefHat,
  CircleCheckBig,
  CircleX,
  Clock,
  ExternalLink,
  Landmark,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playKitchenBell } from "@/components/admin/image-utils";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Toggle } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import type { Order, OrderStatus, StoreSettings } from "@/lib/types";
import { cn, formatVND, STATUS_LABEL } from "@/lib/utils";

interface OrdersTabProps {
  settings: StoreSettings;
  onSettingsChanged: (next: StoreSettings) => void;
}

const FILTER_TABS: { value: "ALL" | OrderStatus; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "COOKING", label: "Đang nấu" },
  { value: "DELIVERING", label: "Đang giao" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const ACTION_BUTTONS: {
  status: OrderStatus;
  label: string;
  icon: typeof ChefHat;
  tone: string;
}[] = [
  {
    status: "COOKING",
    label: "Đang nấu",
    icon: ChefHat,
    tone: "border-warn/40 bg-warn/15 text-warn hover:bg-warn/25",
  },
  {
    status: "DELIVERING",
    label: "Đang giao",
    icon: Bike,
    tone: "border-sky-400/40 bg-sky-400/15 text-sky-300 hover:bg-sky-400/25",
  },
  {
    status: "COMPLETED",
    label: "Hoàn tất",
    icon: CircleCheckBig,
    tone: "border-ok/40 bg-ok/15 text-ok hover:bg-ok/25",
  },
  {
    status: "CANCELLED",
    label: "Hủy",
    icon: CircleX,
    tone: "border-danger/35 bg-danger/10 text-danger hover:bg-danger/20",
  },
];

export function OrdersTab({ settings, onSettingsChanged }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [search, setSearch] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  const knownIdsRef = useRef<Set<string> | null>(null);

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await api<{ orders: Order[] }>("/api/admin/orders");
        const incoming = res.orders;

        // Detect newly arrived PENDING orders to ring kitchen bell
        if (knownIdsRef.current !== null) {
          const newPending = incoming.filter(
            (o) => o.status === "PENDING" && !knownIdsRef.current!.has(o.id),
          );
          if (newPending.length > 0) {
            if (soundEnabled) playKitchenBell();
            toast(`🚨 Có đơn mới: ${newPending.map((o) => o.order_code).join(", ")}!`);
          }
        }
        knownIdsRef.current = new Set(incoming.map((o) => o.id));
        setOrders(incoming);
      } catch (e) {
        if (!silent) toast(errorMessage(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [soundEnabled],
  );

  // Poll every 5 seconds for live kitchen view
  useEffect(() => {
    const poll = () => {
      api<{ orders: Order[] }>("/api/admin/orders")
        .then((res) => {
          const incoming = res.orders;
          if (knownIdsRef.current !== null) {
            const newPending = incoming.filter(
              (o) => o.status === "PENDING" && !knownIdsRef.current!.has(o.id),
            );
            if (newPending.length > 0) {
              if (soundEnabled) playKitchenBell();
              toast(`🚨 Có đơn mới: ${newPending.map((o) => o.order_code).join(", ")}!`);
            }
          }
          knownIdsRef.current = new Set(incoming.map((o) => o.id));
          setOrders(incoming);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [soundEnabled]);

  const handleToggleStoreOpen = async (nextOpen: boolean) => {
    setTogglingOpen(true);
    try {
      const res = await api<{ settings: StoreSettings }>("/api/admin/settings", {
        method: "PUT",
        json: { is_open: nextOpen },
      });
      onSettingsChanged(res.settings);
      toast(nextOpen ? "🟢 Đã mở cửa nhận đơn!" : "🔴 Đã tạm ngưng nhận đơn.");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setTogglingOpen(false);
    }
  };

  const handleChangeStatus = async (order: Order, nextStatus: OrderStatus) => {
    if (order.status === nextStatus) return;
    setUpdatingId(order.id);
    try {
      const res = await api<{ order: Order }>(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        json: { status: nextStatus },
      });
      setOrders((cur) => cur.map((o) => (o.id === order.id ? res.order : o)));
      toast(`${order.order_code} → ${STATUS_LABEL[nextStatus]}`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // KPI calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("vi-VN");
    const todayOrders = orders.filter(
      (o) => new Date(o.created_at).toLocaleDateString("vi-VN") === todayStr,
    );
    const activeCount = orders.filter(
      (o) => o.status === "PENDING" || o.status === "COOKING" || o.status === "DELIVERING",
    ).length;
    const revenueToday = todayOrders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((s, o) => s + o.total_amount, 0);

    const counts: Record<string, number> = { ALL: orders.length };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    }

    return {
      todayTotal: todayOrders.length,
      activeCount,
      revenueToday,
      counts,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_code.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        (o.table_number ?? "").toLowerCase().includes(q) ||
        (o.delivery_address ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, search]);

  return (
    <div className="space-y-5">
      {/* ---------- 1. Big Store Open / Close Switch Card ---------- */}
      <div
        className={cn(
          "card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 transition",
          settings.is_open ? "border-ok/30 bg-ok/[0.06]" : "border-danger/30 bg-danger/[0.06]",
        )}
      >
        <div className="flex items-center gap-3.5">
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-2xl text-xl",
              settings.is_open ? "bg-ok/20 text-ok" : "bg-danger/20 text-danger",
            )}
          >
            {settings.is_open ? "🟢" : "🔴"}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold sm:text-lg">
                {settings.is_open ? "Quán đang MỞ CỬA nhận đơn" : "Quán đang TẠM ĐÓNG CỬA"}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-white/55">
              {settings.is_open
                ? "Khách hàng có thể quét QR tại bàn hoặc đặt giao hàng bình thường."
                : "Nút đặt hàng trên trang chủ đã bị khóa và hiện thông báo nghỉ."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white/70">
            {settings.is_open ? "Đang mở" : "Tạm đóng"}
          </span>
          <Toggle
            id="store-open-toggle"
            size="lg"
            checked={settings.is_open}
            disabled={togglingOpen}
            onChange={handleToggleStoreOpen}
            label="Đóng/Mở quán nhận đơn"
          />
        </div>
      </div>

      {/* ---------- 2. Quick KPI Metrics & Sound Alert ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3.5">
          <p className="text-xs text-white/50">Đơn đang xử lý</p>
          <p className="mt-1 flex items-baseline gap-2 text-2xl font-extrabold tabular-nums">
            {stats.activeCount}
            {stats.activeCount > 0 && (
              <span className="size-2 animate-ping rounded-full bg-warn" />
            )}
          </p>
        </div>

        <div className="card p-3.5">
          <p className="text-xs text-white/50">Đơn hôm nay</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{stats.todayTotal}</p>
        </div>

        <div className="card p-3.5">
          <p className="flex items-center gap-1 text-xs text-white/50">
            <TrendingUp className="size-3.5 text-ok" /> Doanh thu hôm nay
          </p>
          <p className="mt-1 text-xl font-extrabold text-ok tabular-nums sm:text-2xl">
            {formatVND(stats.revenueToday)}
          </p>
        </div>

        <div className="card flex items-center justify-between gap-2 p-3.5">
          <div>
            <p className="text-xs text-white/50">Chuông báo đơn</p>
            <p className="mt-1 text-xs font-semibold">
              {soundEnabled ? "Đang bật 🔊" : "Đã tắt 🔇"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playKitchenBell();
              toast(next ? "Đã bật chuông báo đơn mới" : "Đã tắt chuông báo đơn");
            }}
            className={cn(
              "grid size-10 cursor-pointer place-items-center rounded-2xl border transition",
              soundEnabled
                ? "border-white bg-white text-black"
                : "border-white/10 bg-white/5 text-white/50",
            )}
            aria-label="Bật/Tắt chuông báo đơn mới"
          >
            {soundEnabled ? <Bell className="size-4.5" /> : <BellOff className="size-4.5" />}
          </button>
        </div>
      </div>

      {/* ---------- 3. Filter Pills + Search + Refresh ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            const count = stats.counts[tab.value] ?? 0;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white",
                )}
              >
                {tab.label}{" "}
                <span className={cn("ml-1 tabular-nums", active ? "text-black/65" : "text-white/40")}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã đơn, SĐT, tên, bàn…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-2 pr-3 pl-9 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/35"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchOrders(false)}
            disabled={refreshing}
            className="btn-ghost px-3 py-2 text-xs"
            aria-label="Làm mới danh sách đơn"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* ---------- 4. Live Orders List ---------- */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-44 skeleton" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card py-14 text-center">
          <Clock className="mx-auto size-9 text-white/25" />
          <p className="mt-3 text-base font-semibold">Chưa có đơn hàng nào</p>
          <p className="mt-1 text-xs text-white/45">
            Đơn hàng mới sẽ tự động xuất hiện tại đây mỗi 5 giây kèm chuông báo.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredOrders.map((order) => {
            const isDelivery = order.order_type === "DELIVERY";
            const busy = updatingId === order.id;
            const timeStr = new Date(order.created_at).toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            });

            return (
              <article
                key={order.id}
                className={cn(
                  "card overflow-hidden p-4 sm:p-5 transition",
                  order.status === "PENDING" && "border-warn/40 bg-warn/[0.04]",
                  order.status === "CANCELLED" && "opacity-60",
                )}
              >
                {/* Top row: Code, Type Badge, Status Badge, Print Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold tracking-tight tabular-nums">
                      {order.order_code}
                    </span>

                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold",
                        isDelivery
                          ? "bg-sky-400/15 text-sky-300"
                          : "bg-white/15 text-white",
                      )}
                    >
                      {isDelivery ? (
                        <>
                          <Bike className="size-3.5" /> GIAO TẬN NƠI
                        </>
                      ) : (
                        <>
                          <Store className="size-3.5" />{" "}
                          {order.table_number ? order.table_number.toUpperCase() : "TẠI BÀN / MANG ĐI"}
                        </>
                      )}
                    </span>

                    <span className="text-xs text-white/40">{timeStr}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold",
                        order.status === "PENDING" && "border-warn/40 bg-warn/15 text-warn",
                        order.status === "COOKING" && "border-amber-400/40 bg-amber-400/15 text-amber-300",
                        order.status === "DELIVERING" && "border-sky-400/40 bg-sky-400/15 text-sky-300",
                        order.status === "COMPLETED" && "border-ok/40 bg-ok/15 text-ok",
                        order.status === "CANCELLED" && "border-danger/40 bg-danger/15 text-danger",
                      )}
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPrintingOrder(order)}
                      aria-label={`In hóa đơn ${order.order_code}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white"
                      title="In phiếu bếp / hóa đơn"
                    >
                      <Printer className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Customer & Delivery Details */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/75">
                  <span>
                    👤 Khách: <b className="text-white">{order.customer_name || "Khách lẻ"}</b>
                  </span>
                  {order.customer_phone && (
                    <a
                      href={`tel:${order.customer_phone}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 font-semibold text-white hover:bg-white/20"
                    >
                      <Phone className="size-3" /> {order.customer_phone}
                    </a>
                  )}
                  {isDelivery && order.delivery_address && (
                    <span className="flex items-center gap-1 text-white/80">
                      <MapPin className="size-3.5 shrink-0 text-white/45" />
                      {order.delivery_address}
                      {order.distance_km != null && (
                        <span className="text-white/45">(~{order.distance_km.toFixed(1)} km)</span>
                      )}
                    </span>
                  )}
                  {isDelivery && order.lat != null && order.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${order.lat},${order.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-ok/30 bg-ok/10 px-2 py-0.5 font-semibold text-ok hover:bg-ok/20"
                    >
                      📍 Mở Google Maps <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>

                {/* Order Items */}
                <ul className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
                  {order.items.map((item, idx) => (
                    <li key={`${item.productId}-${idx}`} className="border-b border-white/5 pb-2 last:border-none last:pb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">
                          <span className="mr-1.5 inline-block rounded-md bg-white px-1.5 py-0.5 text-xs font-extrabold text-black tabular-nums">
                            x{item.quantity}
                          </span>
                          {item.productName}
                        </span>
                        <span className="font-semibold tabular-nums text-white/80">
                          {formatVND(item.subtotal)}
                        </span>
                      </div>
                      {item.selectedToppings.length > 0 && (
                        <p className="mt-1 pl-7 text-xs text-white/70">
                          + Topping:{" "}
                          {item.selectedToppings
                            .map((t) => `${t.name} (x${t.quantity})`)
                            .join(", ")}
                        </p>
                      )}
                      {(item.quickTags.length > 0 || item.itemNote) && (
                        <p className="mt-0.5 pl-7 text-xs font-medium text-warn">
                          ⚡ Ghi chú món: {[...item.quickTags, item.itemNote].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                {/* General Notes */}
                {(order.quick_notes.length > 0 || order.custom_note) && (
                  <p className="mt-2.5 rounded-xl border border-warn/25 bg-warn/10 px-3 py-2 text-xs text-warn">
                    <b>📝 Ghi chú đơn:</b>{" "}
                    {[...order.quick_notes.map((n) => `[${n}]`), order.custom_note]
                      .filter(Boolean)
                      .join(" — ")}
                  </p>
                )}

                {/* Bottom row: Payment + Total + Quick Status Buttons */}
                <div className="mt-3.5 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium">
                      {order.payment_method === "VIETQR" ? (
                        <>
                          <Landmark className="size-3.5 text-sky-300" /> Chuyển khoản VietQR
                        </>
                      ) : (
                        <>
                          <Banknote className="size-3.5 text-ok" /> Tiền mặt
                        </>
                      )}
                    </span>
                    <span className="text-base font-extrabold tabular-nums">
                      Tổng thu: {formatVND(order.total_amount)}
                      {order.shipping_fee > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-white/45">
                          (gồm ship {formatVND(order.shipping_fee)})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {ACTION_BUTTONS.map((btn) => {
                      // Hide "Đang giao" button for Dine-in orders to keep UI super clean
                      if (!isDelivery && btn.status === "DELIVERING") return null;
                      const Icon = btn.icon;
                      const isCurrent = order.status === btn.status;
                      return (
                        <button
                          key={btn.status}
                          type="button"
                          disabled={busy || isCurrent}
                          onClick={() => void handleChangeStatus(order, btn.status)}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition active:scale-95 disabled:pointer-events-none",
                            isCurrent
                              ? "border-white bg-white text-black shadow-md"
                              : btn.tone,
                          )}
                        >
                          <Icon className="size-3.5" />
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ---------- Thermal Receipt Print Modal ---------- */}
      <BottomSheet
        open={Boolean(printingOrder)}
        onClose={() => setPrintingOrder(null)}
        title={printingOrder ? `Phiếu in ${printingOrder.order_code}` : "Phiếu in"}
        footer={
          printingOrder ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-primary w-full py-3.5"
            >
              <Printer className="size-4" /> In phiếu ngay (Máy in nhiệt 58mm/80mm)
            </button>
          ) : null
        }
      >
        {printingOrder && (
          <div className="mx-auto max-w-xs rounded-2xl bg-white p-5 font-mono text-xs text-black shadow-lg">
            <div className="border-b border-dashed border-black/40 pb-2 text-center">
              <p className="text-base font-bold">{settings.store_name.toUpperCase()}</p>
              <p className="mt-0.5 text-lg font-extrabold">{printingOrder.order_code}</p>
              <p className="text-[11px]">
                {printingOrder.order_type === "DELIVERY"
                  ? "GIAO TẬN NƠI"
                  : printingOrder.table_number || "TẠI BÀN / MANG ĐI"}
              </p>
              <p className="text-[10px] text-black/60">
                {new Date(printingOrder.created_at).toLocaleString("vi-VN")}
              </p>
            </div>

            <div className="border-b border-dashed border-black/40 py-2 text-[11px]">
              <p>Khách: {printingOrder.customer_name || "Khách lẻ"}</p>
              {printingOrder.customer_phone && <p>SĐT: {printingOrder.customer_phone}</p>}
              {printingOrder.delivery_address && <p>Đ/c: {printingOrder.delivery_address}</p>}
            </div>

            <div className="space-y-1.5 border-b border-dashed border-black/40 py-2">
              {printingOrder.items.map((it, i) => (
                <div key={i}>
                  <div className="flex justify-between font-bold">
                    <span>
                      {it.quantity}x {it.productName}
                    </span>
                    <span>{formatVND(it.subtotal)}</span>
                  </div>
                  {it.selectedToppings.map((t) => (
                    <p key={t.id} className="pl-2 text-[11px]">
                      + {t.name} x{t.quantity} ({formatVND(t.price * t.quantity)})
                    </p>
                  ))}
                  {(it.quickTags.length > 0 || it.itemNote) && (
                    <p className="pl-2 text-[11px] italic">
                      * {[...it.quickTags, it.itemNote].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {(printingOrder.quick_notes.length > 0 || printingOrder.custom_note) && (
              <div className="border-b border-dashed border-black/40 py-1.5 text-[11px]">
                Ghi chú:{" "}
                {[...printingOrder.quick_notes, printingOrder.custom_note]
                  .filter(Boolean)
                  .join(" - ")}
              </div>
            )}

            <div className="pt-2 text-xs">
              {printingOrder.shipping_fee > 0 && (
                <div className="flex justify-between">
                  <span>Phí giao hàng:</span>
                  <span>{formatVND(printingOrder.shipping_fee)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between text-sm font-extrabold">
                <span>TỔNG THU:</span>
                <span>{formatVND(printingOrder.total_amount)}</span>
              </div>
              <p className="mt-1 text-center text-[11px]">
                ({printingOrder.payment_method === "VIETQR" ? "Chuyển khoản VietQR" : "Tiền mặt"})
              </p>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

