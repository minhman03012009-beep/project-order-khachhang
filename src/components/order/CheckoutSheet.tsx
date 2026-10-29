"use client";

import {
  Banknote,
  Bike,
  Landmark,
  Loader2,
  LocateFixed,
  MapPin,
  MessageSquareText,
  Sparkles,
  Store,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ModeSwitch } from "@/components/order/StoreHeader";
import { VietQrCard } from "@/components/order/VietQrCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { SmartImage } from "@/components/ui/SmartImage";
import { toast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { lineTotal, unitPrice, useOrderStore } from "@/lib/store";
import type {
  CreateOrderInput,
  CustomerLookupResponse,
  Order,
  PaymentMethod,
  PublicSettings,
} from "@/lib/types";
import {
  cn,
  computeShippingFee,
  DELIVERY_QUICK_TAGS,
  formatVND,
  haversineKm,
  isValidPhone,
} from "@/lib/utils";

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  settings: PublicSettings;
  onPlaced: (order: Order, customerOrderCount: number | null) => void;
  /** Called when the server says the menu changed (sold out / closed). */
  onMenuStale: () => void;
}

type GpsState = { status: "idle" | "loading" | "ok" | "error"; message?: string };

function shortAddress(displayName: string): string {
  return displayName
    .split(",")
    .map((s) => s.trim())
    .filter((p) => p && !/^\d{5,6}$/.test(p) && p !== "Việt Nam" && p !== "Vietnam")
    .slice(0, 4)
    .join(", ");
}

export function CheckoutSheet({ open, onClose, settings, onPlaced, onMenuStale }: CheckoutSheetProps) {
  const cart = useOrderStore((s) => s.cart);
  const mode = useOrderStore((s) => s.mode);
  const setMode = useOrderStore((s) => s.setMode);
  const tableNumber = useOrderStore((s) => s.tableNumber);
  const setTableNumber = useOrderStore((s) => s.setTableNumber);
  const customer = useOrderStore((s) => s.customer);
  const setCustomer = useOrderStore((s) => s.setCustomer);
  const setQty = useOrderStore((s) => s.setQty);

  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [deliveryTags, setDeliveryTags] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");
  const [useSaved, setUseSaved] = useState(false);
  const [lookup, setLookup] = useState<{ phone: string; data: CustomerLookupResponse } | null>(null);
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const phone = customer.phone;
  const isDelivery = mode === "DELIVERY";
  const known = lookup && lookup.phone === phone ? lookup.data : null;
  const savedActive = useSaved && Boolean(known?.has_address);

  // ---------- invisible account lookup (debounced, only for a full 10-digit phone) ----------
  useEffect(() => {
    if (!open || !isValidPhone(phone)) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await api<CustomerLookupResponse>(`/api/customers/${phone}`, { signal: ctrl.signal });
        setLookup({ phone, data });
        if (data.found) {
          const cur = useOrderStore.getState().customer;
          if (!cur.name.trim() && data.name) setCustomer({ name: data.name });
          if (!cur.address.trim() && data.has_address) setUseSaved(true);
        }
      } catch {
        /* lookup is best-effort */
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, phone, setCustomer]);

  // ---------- preview of the next order code for the VietQR memo ----------
  useEffect(() => {
    if (!open || payment !== "VIETQR") return;
    const ctrl = new AbortController();
    api<{ code: string }>("/api/orders/next-code", { signal: ctrl.signal })
      .then((d) => setPreviewCode(d.code))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [open, payment]);

  // ---------- money ----------
  const itemsTotal = cart.reduce((s, it) => s + lineTotal(it), 0);
  const boxes = cart.reduce((s, it) => s + it.quantity, 0);
  const hasGps = customer.lat != null && customer.lng != null;
  const distance =
    isDelivery && hasGps
      ? haversineKm(customer.lat!, customer.lng!, settings.store_lat, settings.store_lng)
      : null;
  const tooFar = distance != null && settings.max_delivery_km > 0 && distance > settings.max_delivery_km;
  const shipping = isDelivery ? computeShippingFee(settings.shipping_fee_per_km, distance) : 0;
  const shippingIsEstimate = isDelivery && distance == null && settings.shipping_fee_per_km > 0;
  const total = itemsTotal + shipping;

  // ---------- GPS (zero map SDK) ----------
  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGps({ status: "error", message: "Trình duyệt không hỗ trợ định vị." });
      return;
    }
    setGps({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e6) / 1e6;
        const lng = Math.round(pos.coords.longitude * 1e6) / 1e6;
        setCustomer({ lat, lng });
        setGps({ status: "ok" });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=vi`,
          );
          const data = (await res.json()) as { display_name?: string };
          const addr = data.display_name ? shortAddress(data.display_name) : "";
          if (!addr) return;
          const cur = useOrderStore.getState().customer.address.trim();
          if (!cur) {
            setCustomer({ address: addr });
            setUseSaved(false);
          } else if (cur !== addr) {
            setSuggestion(addr);
          }
        } catch {
          /* reverse geocoding is optional */
        }
      },
      (err) =>
        setGps({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Bạn đã chặn quyền vị trí. Hãy bật lại trong cài đặt trình duyệt."
              : "Không lấy được vị trí, bạn thử lại nhé.",
        }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  // ---------- validation & submit ----------
  const validate = (): string | null => {
    if (!settings.is_open) return "Quán đang tạm ngưng nhận đơn.";
    if (cart.length === 0) return "Giỏ hàng đang trống.";
    if (phone && !isValidPhone(phone)) return "Số điện thoại cần đủ 10 số, bắt đầu bằng 0.";
    if (isDelivery) {
      if (!customer.name.trim()) return "Vui lòng nhập tên người nhận.";
      if (!phone) return "Vui lòng nhập số điện thoại để shipper liên hệ.";
      if (!savedActive && !customer.address.trim()) return "Vui lòng nhập địa chỉ giao hàng.";
      if (tooFar) return `Bạn đang ở ngoài bán kính giao hàng ${settings.max_delivery_km} km.`;
    } else if (!tableNumber.trim() && !customer.name.trim()) {
      return "Vui lòng nhập số bàn hoặc tên của bạn.";
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      toast(err, "error");
      return;
    }
    setSubmitting(true);
    const body: CreateOrderInput = {
      order_type: mode,
      table_number: isDelivery ? undefined : tableNumber.trim(),
      customer_name: customer.name.trim(),
      customer_phone: phone,
      delivery_address: isDelivery && !savedActive ? customer.address.trim() : undefined,
      use_saved_address: isDelivery && savedActive,
      lat: isDelivery ? customer.lat : null,
      lng: isDelivery ? customer.lng : null,
      items: cart.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        toppings: it.toppings.map((t) => ({ id: t.id, quantity: t.quantity })),
        quickTags: it.quickTags,
        itemNote: it.itemNote,
      })),
      quick_notes: isDelivery ? deliveryTags : [],
      custom_note: customNote.trim(),
      payment_method: payment,
      preferred_code: payment === "VIETQR" && previewCode ? previewCode : undefined,
    };
    try {
      const res = await api<{ order: Order; customerOrderCount: number | null }>("/api/orders", {
        method: "POST",
        json: body,
      });
      setCustomNote("");
      setDeliveryTags([]);
      setPreviewCode(null);
      onPlaced(res.order, res.customerOrderCount);
    } catch (e) {
      toast(errorMessage(e), "error");
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) onMenuStale();
    } finally {
      setSubmitting(false);
    }
  };

  const footer =
    cart.length > 0 ? (
      <div>
        <div className="mb-2.5 flex items-baseline justify-between text-sm">
          <span className="text-white/55">
            Tổng thanh toán · {boxes} hộp
            {shippingIsEstimate && <span className="text-white/35"> (ship tạm tính)</span>}
          </span>
          <span key={total} className="animate-pop text-xl font-bold tabular-nums">
            {formatVND(total)}
          </span>
        </div>
        <button
          id="place-order-btn"
          type="button"
          onClick={submit}
          disabled={submitting || !settings.is_open || tooFar}
          className="btn-primary w-full py-4 text-[15px]"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4.5 animate-spin" /> Đang gửi đơn…
            </>
          ) : !settings.is_open ? (
            "Quán đang tạm ngưng nhận đơn"
          ) : (
            <>Chốt đơn hàng • {formatVND(total)}</>
          )}
        </button>
      </div>
    ) : undefined;

  return (
    <BottomSheet open={open} onClose={onClose} title="Xác nhận đơn hàng" footer={footer} size="lg">
      {cart.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-5xl">🥢</p>
          <p className="mt-3 font-semibold">Giỏ hàng đang trống</p>
          <p className="mt-1 text-sm text-white/50">Chọn một hộp mì thật ngon trước nhé!</p>
          <button type="button" onClick={onClose} className="btn-ghost mt-5">
            Quay lại thực đơn
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {!settings.is_open && (
            <p className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Quán đang tạm ngưng nhận đơn. Bạn vẫn có thể giữ giỏ hàng và quay lại sau nhé!
            </p>
          )}

          {/* ---------- Cart lines ---------- */}
          <ul className="space-y-2.5">
            {cart.map((it) => (
              <li key={it.lineId} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                  <SmartImage src={it.image_url} alt={it.productName} sizes="64px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-snug font-semibold">{it.productName}</p>
                    <button
                      type="button"
                      aria-label={`Xóa ${it.productName}`}
                      onClick={() => setQty(it.lineId, 0)}
                      className="-mt-0.5 -mr-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white/35 transition hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {it.toppings.length > 0 && (
                    <p className="mt-0.5 text-xs text-white/55">
                      + {it.toppings.map((t) => `${t.name}${t.quantity > 1 ? ` x${t.quantity}` : ""}`).join(", ")}
                    </p>
                  )}
                  {(it.quickTags.length > 0 || it.itemNote) && (
                    <p className="mt-0.5 text-xs text-white/40 italic">
                      {[...it.quickTags, it.itemNote].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold tabular-nums">
                      {formatVND(lineTotal(it))}
                      {it.quantity > 1 && (
                        <span className="ml-1 text-xs font-normal text-white/40">
                          ({formatVND(unitPrice(it))}/hộp)
                        </span>
                      )}
                    </span>
                    <QtyStepper size="sm" value={it.quantity} min={0} onChange={(v) => setQty(it.lineId, v)} label="số hộp" />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* ---------- Mode ---------- */}
          <ModeSwitch mode={mode} onChange={setMode} />

          {/* ---------- Customer ---------- */}
          <Section icon={isDelivery ? <Bike className="size-4" /> : <Store className="size-4" />} title={isDelivery ? "Thông tin giao hàng" : "Thông tin của bạn"}>
            {isDelivery ? (
              <div className="space-y-3">
                <PhoneField value={phone} onChange={(v) => setCustomer({ phone: v })} required />
                <Welcome data={known} />
                <div>
                  <label htmlFor="cus-name" className="label">Tên người nhận</label>
                  <input
                    id="cus-name"
                    value={customer.name}
                    onChange={(e) => setCustomer({ name: e.target.value })}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="VD: Minh Khoa"
                    className="field"
                  />
                </div>

                <div>
                  <label htmlFor="cus-address" className="label">Địa chỉ giao hàng</label>
                  {savedActive && known ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3">
                      <MapPin className="size-4 shrink-0 text-ok" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ok">Dùng lại địa chỉ đã lưu</p>
                        <p className="truncate text-sm font-medium">{known.masked_address}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseSaved(false)}
                        className="shrink-0 cursor-pointer text-xs font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline"
                      >
                        Đổi địa chỉ
                      </button>
                    </div>
                  ) : (
                    <>
                      <textarea
                        id="cus-address"
                        value={customer.address}
                        onChange={(e) => setCustomer({ address: e.target.value })}
                        maxLength={300}
                        rows={2}
                        autoComplete="street-address"
                        placeholder="Số nhà, hẻm, tên đường, phường… (VD: Hẻm 45, đối diện tiệm tạp hóa)"
                        className="field resize-none"
                      />
                      {known?.has_address && (
                        <button
                          type="button"
                          onClick={() => setUseSaved(true)}
                          className="mt-1.5 cursor-pointer text-xs text-white/55 hover:text-white"
                        >
                          ↺ Dùng lại địa chỉ cũ: <span className="font-medium">{known.masked_address}</span>
                        </button>
                      )}
                    </>
                  )}
                  {suggestion && !savedActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomer({ address: suggestion });
                        setSuggestion(null);
                      }}
                      className="animate-rise mt-2 flex w-full cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left text-xs text-white/70 transition hover:bg-white/10"
                    >
                      <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Gợi ý từ GPS: <span className="font-medium text-white">{suggestion}</span>
                      </span>
                    </button>
                  )}
                </div>

                {/* GPS */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  {hasGps && distance != null ? (
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl",
                          tooFar ? "bg-danger/15 text-danger" : "bg-ok/15 text-ok",
                        )}
                      >
                        {tooFar ? <TriangleAlert className="size-4" /> : <MapPin className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1 text-[13px]">
                        <p className="font-semibold">Đã ghim GPS – Cách quán ~{distance.toFixed(1)} km</p>
                        <p className={tooFar ? "text-danger" : "text-white/50"}>
                          {tooFar
                            ? `Rất tiếc, vượt bán kính giao hàng ${settings.max_delivery_km} km của quán.`
                            : shipping > 0
                              ? `Phí ship: ${formatVND(shipping)}`
                              : "Miễn phí giao hàng 🎉"}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Bỏ ghim vị trí"
                        onClick={() => {
                          setCustomer({ lat: null, lng: null });
                          setGps({ status: "idle" });
                        }}
                        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      id="gps-btn"
                      type="button"
                      onClick={locate}
                      disabled={gps.status === "loading"}
                      className="btn-ghost w-full"
                    >
                      {gps.status === "loading" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LocateFixed className="size-4" />
                      )}
                      {gps.status === "loading" ? "Đang lấy vị trí…" : "📍 Lấy vị trí hiện tại của tôi"}
                    </button>
                  )}
                  {gps.status === "error" && <p className="mt-2 text-xs text-danger">{gps.message}</p>}
                  {!hasGps && gps.status !== "error" && (
                    <p className="mt-2 text-center text-[11px] text-white/35">
                      Giúp shipper tìm đúng nhà & tính phí ship chính xác. Không cần bản đồ.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {DELIVERY_QUICK_TAGS.map((tag) => {
                    const on = deliveryTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setDeliveryTags((cur) => (on ? cur.filter((t) => t !== tag) : [...cur, tag]))
                        }
                        className={on ? "pill-on" : "pill-off"}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="label">Số bàn / Tên của bạn</span>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {["Mang đi", "Bàn số 1", "Bàn số 2", "Bàn số 3", "Bàn số 4", "Bàn số 5", "Bàn số 6"].map(
                      (preset) => {
                        const active = tableNumber.trim().toLowerCase() === preset.toLowerCase();
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTableNumber(preset)}
                            className={cn(
                              "cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-medium transition",
                              active
                                ? "border-white bg-white text-black font-semibold"
                                : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white",
                            )}
                          >
                            {preset}
                          </button>
                        );
                      },
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      id="table-number"
                      aria-label="Số bàn"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      maxLength={40}
                      placeholder="Số bàn (VD: Bàn số 3)"
                      className="field"
                    />
                    <input
                      id="cus-name"
                      aria-label="Tên của bạn"
                      value={customer.name}
                      onChange={(e) => setCustomer({ name: e.target.value })}
                      maxLength={80}
                      autoComplete="name"
                      placeholder="Tên của bạn"
                      className="field"
                    />
                  </div>
                </div>
                <PhoneField value={phone} onChange={(v) => setCustomer({ phone: v })} />
                <Welcome data={known} />
              </div>
            )}
          </Section>

          {/* ---------- Note ---------- */}
          <Section icon={<MessageSquareText className="size-4" />} title="Ghi chú cho quán">
            <textarea
              id="custom-note"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder={isDelivery ? "VD: Tới đầu hẻm gọi mình ra lấy nha" : "VD: Mang đi, cho thêm đũa"}
              className="field resize-none"
            />
          </Section>

          {/* ---------- Payment ---------- */}
          <Section icon={<Landmark className="size-4" />} title="Phương thức thanh toán">
            <div className="grid grid-cols-2 gap-2">
              <PayOption
                id="pay-cash"
                active={payment === "CASH"}
                onClick={() => setPayment("CASH")}
                icon={<Banknote className="size-5" />}
                title="Tiền mặt"
                sub={isDelivery ? "Trả khi nhận (COD)" : "Trả tại quầy"}
              />
              <PayOption
                id="pay-vietqr"
                active={payment === "VIETQR"}
                onClick={() => setPayment("VIETQR")}
                icon={<Landmark className="size-5" />}
                title="Chuyển khoản"
                sub="Quét VietQR"
              />
            </div>
            {payment === "VIETQR" && (
              <div className="mt-3">
                <VietQrCard settings={settings} amount={total} orderCode={previewCode} />
                <p className="mt-2 text-center text-[11px] text-white/40">
                  Chưa kịp quét? Mã QR sẽ hiện lại ở màn hình hóa đơn sau khi chốt đơn.
                </p>
              </div>
            )}
          </Section>

          {/* ---------- Summary ---------- */}
          <dl className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-white/55">Tạm tính ({boxes} hộp)</dt>
              <dd className="tabular-nums">{formatVND(itemsTotal)}</dd>
            </div>
            {isDelivery && (
              <div className="flex justify-between">
                <dt className="text-white/55">
                  Phí giao hàng {distance != null ? `(~${distance.toFixed(1)} km)` : shippingIsEstimate ? "(tạm tính 1 km)" : ""}
                </dt>
                <dd className="tabular-nums">{shipping > 0 ? formatVND(shipping) : "Miễn phí"}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold">
              <dt>Tổng cộng</dt>
              <dd className="tabular-nums">{formatVND(total)}</dd>
            </div>
          </dl>
        </div>
      )}
    </BottomSheet>
  );
}

// ------------------------------------------------------------------

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-white/10">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function PhoneField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const invalid = value.length > 0 && value.length === 10 && !isValidPhone(value);
  return (
    <div>
      <label htmlFor="cus-phone" className="label">
        {required ? "Số điện thoại" : "Số điện thoại (tùy chọn để tích điểm)"}
      </label>
      <div className="relative">
        <UserRound className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/35" />
        <input
          id="cus-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="09xx xxx xxx"
          className={cn("field pl-11 tabular-nums tracking-wide", invalid && "border-danger/60")}
        />
      </div>
    </div>
  );
}

function Welcome({ data }: { data: CustomerLookupResponse | null }) {
  if (!data?.found) return null;
  return (
    <p className="animate-rise flex items-center gap-2 rounded-2xl border border-white/15 bg-gradient-to-r from-white/10 to-white/[0.02] px-3.5 py-2.5 text-[13px]">
      <span className="text-lg">👋</span>
      <span>
        Chào mừng {data.name ? <b>{data.name}</b> : "bạn"} quay lại! Đây là đơn thứ{" "}
        <b>{(data.total_orders ?? 0) + 1}</b> của bạn.
      </span>
    </p>
  );
}

function PayOption({
  id,
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition duration-200 active:scale-[0.98]",
        active ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.03] hover:border-white/25",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", active ? "bg-black/10" : "bg-white/10")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={cn("block text-[11px]", active ? "text-black/60" : "text-white/45")}>{sub}</span>
      </span>
    </button>
  );
}
