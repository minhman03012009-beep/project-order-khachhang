"use client";

import {
  Check,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Landmark,
  Loader2,
  LocateFixed,
  MapPin,
  Palette,
  QrCode,
  Save,
  Send,
  Shield,
  Sparkles,
  Store,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { generateTableQrStickerDataUrl } from "@/components/admin/image-utils";
import { VietQrCard } from "@/components/order/VietQrCard";
import { Toggle } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import {
  getContrastTextColor,
  INDUSTRY_TEMPLATES,
  THEME_PRESETS,
} from "@/lib/theme";
import type { StoreSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const POPULAR_BANKS = [
  { id: "MB", name: "MB Bank (Quân Đội)" },
  { id: "VCB", name: "Vietcombank" },
  { id: "TCB", name: "Techcombank" },
  { id: "ACB", name: "ACB (Á Châu)" },
  { id: "BIDV", name: "BIDV" },
  { id: "ICB", name: "VietinBank" },
  { id: "TPB", name: "TPBank" },
  { id: "VPB", name: "VPBank" },
  { id: "STB", name: "Sacombank" },
  { id: "VBA", name: "Agribank" },
  { id: "VIB", name: "VIB" },
  { id: "HDB", name: "HDBank" },
  { id: "SHB", name: "SHB" },
  { id: "MSB", name: "MSB" },
  { id: "OCB", name: "OCB" },
];

export function SettingsTab({
  settings,
  onSettingsChanged,
}: {
  settings: StoreSettings;
  onSettingsChanged: (next: StoreSettings) => void;
}) {
  const [form, setForm] = useState<StoreSettings>(settings);
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  // Table QR Generator state
  const [tableInput, setTableInput] = useState("1");
  const [qrStickerUrl, setQrStickerUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const tableClean = tableInput.trim() || "1";
  const tableLabel = /^\d+$/.test(tableClean) ? `Bàn số ${tableClean}` : tableClean;
  const tableUrl = `${origin}/?table=${encodeURIComponent(tableClean)}`;

  useEffect(() => {
    let cancelled = false;
    generateTableQrStickerDataUrl({
      url: tableUrl,
      storeName: form.store_name || "Tiệm Mì Indomie",
      tableLabel,
    })
      .then((dataUrl) => {
        if (!cancelled) setQrStickerUrl(dataUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tableUrl, form.store_name, tableLabel]);

  const handleLocateStore = () => {
    if (!("geolocation" in navigator)) {
      toast("Trình duyệt không hỗ trợ định vị GPS.", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const store_lat = Math.round(pos.coords.latitude * 1e6) / 1e6;
        const store_lng = Math.round(pos.coords.longitude * 1e6) / 1e6;
        setForm((cur) => ({ ...cur, store_lat, store_lng }));
        setLocating(false);
        toast(`📍 Đã lấy tọa độ quán (${store_lat}, ${store_lng})! Nhớ bấm Lưu cấu hình.`);
      },
      (err) => {
        setLocating(false);
        toast(
          err.code === err.PERMISSION_DENIED
            ? "Bạn đã chặn quyền vị trí trên trình duyệt."
            : "Không lấy được GPS, vui lòng thử lại.",
          "error",
        );
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handleTestTelegram = async () => {
    if (!form.telegram_bot_token.trim() || !form.telegram_chat_id.trim()) {
      toast("Vui lòng nhập cả Bot Token và Chat ID trước khi gửi test.", "error");
      return;
    }
    setTestingTelegram(true);
    try {
      await api("/api/admin/telegram-test", {
        method: "POST",
        json: {
          token: form.telegram_bot_token.trim(),
          chatId: form.telegram_chat_id.trim(),
        },
      });
      toast("✅ Đã gửi tin nhắn Test về Telegram thành công!");
    } catch (e) {
      toast(`Lỗi Telegram: ${errorMessage(e)}`, "error");
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleExportConfig = () => {
    const { admin_pin: _p, telegram_bot_token: _t, bank_webhook_secret: _b, telegram_webhook_secret: _tw, ...safeExport } = form;
    void _p;
    void _t;
    void _b;
    void _tw;
    const blob = new Blob([JSON.stringify(safeExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-template-${form.theme_preset || "custom"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("📦 Đã xuất gói cấu hình quán (.json) để nhân bản!");
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<StoreSettings>;
      setForm((cur) => ({
        ...cur,
        ...parsed,
        id: cur.id,
        admin_pin: cur.admin_pin,
      }));
      toast("✨ Đã nạp file cấu hình! Hãy bấm Lưu để áp dụng.");
    } catch {
      toast("File JSON không hợp lệ.", "error");
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<StoreSettings> = {
        ...form,
        admin_pin: newPin.trim() ? newPin.trim() : undefined,
      };
      const res = await api<{ settings: StoreSettings }>("/api/admin/settings", {
        method: "PUT",
        json: payload,
      });
      onSettingsChanged(res.settings);
      setForm(res.settings);
      setNewPin("");
      toast("💾 Đã lưu toàn bộ cấu hình quán!");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const previewAccentFg = getContrastTextColor(form.theme_accent_color || "#ffffff");
  const isLightPreview = form.theme_mode === "light";

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      {/* ---------- 1. Theme & Custom Color Studio (White-Label SaaS) ---------- */}
      <section className="card space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-white text-black">
              <Palette className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Tùy chỉnh Màu nền &amp; Giao diện Thương hiệu
              </h2>
              <p className="text-xs text-white/55">
                Đổi màu nền, màu nút bấm hoặc chọn bộ giao diện có sẵn — áp dụng tức thì lên trang khách.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json"
              onChange={handleImportConfig}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExportConfig}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              <Download className="size-3.5" /> Xuất Template (.JSON)
            </button>
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              <Upload className="size-3.5" /> Nạp Template
            </button>
          </div>
        </div>

        {/* 6 Curated Theme Presets */}
        <div>
          <label className="label">Bộ màu giao diện nhanh (1 chạm)</label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {THEME_PRESETS.map((preset) => {
              const active = form.theme_preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setForm((cur) => ({
                      ...cur,
                      theme_preset: preset.id,
                      theme_mode: preset.mode,
                      theme_bg_color: preset.bgColor,
                      theme_accent_color: preset.accentColor,
                    }))
                  }
                  className={cn(
                    "cursor-pointer rounded-2xl border p-3 text-left transition active:scale-[0.98]",
                    active
                      ? "border-white bg-white/10 ring-2 ring-white/40"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-5 shrink-0 rounded-full border border-white/25 shadow"
                      style={{ backgroundColor: preset.bgColor }}
                    />
                    <span
                      className="size-5 shrink-0 rounded-full border border-white/25 shadow -ml-3.5"
                      style={{ backgroundColor: preset.accentColor }}
                    />
                    <span className="truncate text-xs font-bold">{preset.name}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-[11px] text-white/50">{preset.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Color Pickers + Live Mini Preview */}
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Màu nền web (Custom Hex)</label>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <input
                    type="color"
                    value={form.theme_bg_color}
                    onChange={(e) =>
                      setForm({ ...form, theme_preset: "custom", theme_bg_color: e.target.value })
                    }
                    className="size-8 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <input
                    value={form.theme_bg_color}
                    onChange={(e) =>
                      setForm({ ...form, theme_preset: "custom", theme_bg_color: e.target.value })
                    }
                    className="w-full bg-transparent font-mono text-xs uppercase outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="label">Màu chủ đạo / Nút bấm</label>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <input
                    type="color"
                    value={form.theme_accent_color}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        theme_preset: "custom",
                        theme_accent_color: e.target.value,
                      })
                    }
                    className="size-8 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <input
                    value={form.theme_accent_color}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        theme_preset: "custom",
                        theme_accent_color: e.target.value,
                      })
                    }
                    className="w-full bg-transparent font-mono text-xs uppercase outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, theme_mode: "dark" })}
                className={cn(
                  "cursor-pointer rounded-2xl border py-2.5 text-xs font-semibold transition",
                  form.theme_mode === "dark"
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/5 text-white/65",
                )}
              >
                🌙 Chữ Sáng (cho nền Tối)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, theme_mode: "light" })}
                className={cn(
                  "cursor-pointer rounded-2xl border py-2.5 text-xs font-semibold transition",
                  form.theme_mode === "light"
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/5 text-white/65",
                )}
              >
                ☀️ Chữ Tối (cho nền Sáng/Kem)
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-xs font-semibold">Cho phép khách tự đổi Sáng / Tối</p>
                <p className="text-[11px] text-white/50">
                  Hiện nút Mặt trời / Mặt trăng nhỏ ở góc trên để cá nhân hóa trải nghiệm.
                </p>
              </div>
              <Toggle
                checked={form.allow_customer_theme_toggle}
                onChange={(v) => setForm({ ...form, allow_customer_theme_toggle: v })}
                label="Cho phép khách đổi theme"
              />
            </div>
          </div>

          {/* Live Theme Card Preview */}
          <div
            className="flex flex-col justify-between rounded-3xl border p-4 shadow-xl transition"
            style={{
              backgroundColor: form.theme_bg_color,
              color: isLightPreview ? "#1E1B1A" : "#f5f5f5",
              borderColor: isLightPreview ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.12)",
            }}
          >
            <div className="space-y-2">
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: isLightPreview ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                }}
              >
                Xem trước giao diện
              </span>
              <p className="text-sm font-bold">{form.menu_title || "Thực đơn"}</p>
              <div
                className="rounded-2xl border p-2.5 text-xs"
                style={{
                  backgroundColor: isLightPreview ? "#ffffff" : "rgba(255,255,255,0.05)",
                  borderColor: isLightPreview ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)",
                }}
              >
                <p className="font-semibold">Món đặc trưng</p>
                <p className="mt-0.5 text-[11px] opacity-60">39.000đ / {form.item_unit_label || "hộp"}</p>
              </div>
            </div>

            <div
              className="mt-3 rounded-xl py-2 text-center text-xs font-bold shadow"
              style={{
                backgroundColor: form.theme_accent_color,
                color: previewAccentFg,
              }}
            >
              Đặt món ngay • 39.000đ
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 2. Commercial Industry Quick-Setup (Bán cho nhiều loại quán) ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              Gói Ngành Hàng Thương Mại (Setup Quán Mới trong 1 chạm)
            </h2>
            <p className="text-xs text-white/55">
              Dành cho việc triển khai &amp; bán giải pháp cho các mô hình quán ăn khác nhau.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {INDUSTRY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                setForm((cur) => ({ ...cur, ...tpl.patch }));
                toast(`✨ Đã áp dụng mẫu "${tpl.name}"! Bấm Lưu để kích hoạt.`);
              }}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/30 hover:bg-white/[0.06]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xl">
                {tpl.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">{tpl.name}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{tpl.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- 3. White-Label Branding & UX Features ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10">
            <Store className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              Thông tin Thương hiệu &amp; Trải nghiệm Khách hàng
            </h2>
            <p className="text-xs text-white/55">
              Tùy biến toàn bộ tên quán, hotline, đơn vị món, cấp cay 0–7, Freeship và giảm giá mang đi.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Tên quán (Header / Hóa đơn / QR)</label>
            <input
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              placeholder="Tiệm Mì Indomie"
              className="field"
            />
          </div>
          <div>
            <label className="label">Tiêu đề Thực đơn</label>
            <input
              value={form.menu_title}
              onChange={(e) => setForm({ ...form, menu_title: e.target.value })}
              placeholder="Thực đơn Mì Trộn"
              className="field"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Hotline hỗ trợ / Đặt nhanh</label>
            <input
              value={form.hotline}
              onChange={(e) => setForm({ ...form, hotline: e.target.value })}
              placeholder="0327469961"
              className="field font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="label">Đơn vị món (hộp/tô/ly)</label>
            <input
              value={form.item_unit_label}
              onChange={(e) => setForm({ ...form, item_unit_label: e.target.value })}
              placeholder="hộp"
              className="field"
            />
          </div>
          <div>
            <label className="label">Giờ mở cửa (Footer)</label>
            <input
              value={form.store_hours}
              onChange={(e) => setForm({ ...form, store_hours: e.target.value })}
              placeholder="Mở cửa mỗi ngày"
              className="field"
            />
          </div>
        </div>

        <div>
          <label className="label">Địa chỉ quán (Hiển thị trên Bill &amp; Footer)</label>
          <input
            value={form.store_address}
            onChange={(e) => setForm({ ...form, store_address: e.target.value })}
            placeholder="VD: Số 2 Hải Triều, Quận 1, TP.HCM"
            className="field"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Ngưỡng Freeship giao hàng (VNĐ)</label>
            <input
              type="number"
              step={10000}
              min={0}
              value={form.freeship_threshold}
              onChange={(e) =>
                setForm({ ...form, freeship_threshold: Math.max(0, Number(e.target.value) || 0) })
              }
              className="field tabular-nums"
            />
            <p className="mt-1 text-[11px] text-white/40">
              Nhập 150000 để hiện thanh tiến trình Freeship. Nhập 0 để tắt.
            </p>
          </div>
          <div>
            <label className="label">Giảm giá khi Ghé quán lấy (%)</label>
            <input
              type="number"
              min={0}
              max={50}
              value={form.self_pickup_discount_pct}
              onChange={(e) =>
                setForm({
                  ...form,
                  self_pickup_discount_pct: Math.min(50, Math.max(0, Number(e.target.value) || 0)),
                })
              }
              className="field tabular-nums"
            />
            <p className="mt-1 text-[11px] text-white/40">
              VD: 10 (giảm 10% khi tự ghé quán lấy). Nhập 0 để ẩn.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-xs font-semibold">🌶️ Chọn Cấp độ cay 0 – 7</p>
              <p className="text-[11px] text-white/45">Bật nếu bán Mì Cay / đồ ăn nhiều cấp cay</p>
            </div>
            <Toggle
              checked={form.enable_spicy_level}
              onChange={(v) => setForm({ ...form, enable_spicy_level: v })}
              label="Chọn cấp độ cay"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-xs font-semibold">🌱 Tùy chọn Đũa muỗng môi trường</p>
              <p className="text-[11px] text-white/45">Cho khách chọn không lấy đũa muỗng nhựa</p>
            </div>
            <Toggle
              checked={form.enable_cutlery_option}
              onChange={(v) => setForm({ ...form, enable_cutlery_option: v })}
              label="Tùy chọn đũa muỗng"
            />
          </div>
        </div>

        {/* GPS & Delivery */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
              <MapPin className="size-4 text-ok" /> Tọa độ GPS của quán (Haversine)
            </span>
            <button
              type="button"
              onClick={handleLocateStore}
              disabled={locating}
              className="btn-primary px-3 py-2 text-xs"
            >
              {locating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LocateFixed className="size-3.5" />
              )}
              📍 Cập nhật tọa độ quán tại vị trí tôi đang đứng
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Vĩ độ (lat)</label>
              <input
                type="number"
                step="any"
                value={form.store_lat}
                onChange={(e) => setForm({ ...form, store_lat: Number(e.target.value) })}
                className="field text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="label">Kinh độ (lng)</label>
              <input
                type="number"
                step="any"
                value={form.store_lng}
                onChange={(e) => setForm({ ...form, store_lng: Number(e.target.value) })}
                className="field text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="label">Bán kính tối đa (km)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.max_delivery_km}
                onChange={(e) => setForm({ ...form, max_delivery_km: Number(e.target.value) })}
                className="field text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="label">Phí ship / km (đ)</label>
              <input
                type="number"
                step="1000"
                min="0"
                value={form.shipping_fee_per_km}
                onChange={(e) =>
                  setForm({ ...form, shipping_fee_per_km: Math.max(0, Number(e.target.value)) })
                }
                className="field text-xs tabular-nums"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 4. Công cụ Tạo Mã QR Đặt Món Cho Từng Bàn ---------- */}
      <section className="card p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white text-black">
            <QrCode className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              Công cụ tạo mã QR đặt món cho từng bàn
            </h2>
            <p className="text-xs text-white/55">
              Khách quét mã tại bàn nào sẽ tự động chọn chế độ <b>Tại bàn</b> và điền sẵn số bàn đó.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_260px] md:items-center">
          <div className="space-y-3.5">
            <div>
              <label className="label">Chọn nhanh hoặc nhập số bàn</label>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Mang đi"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setTableInput(num)}
                    className={cn(
                      "cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                      tableInput === num
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/5 text-white/70 hover:border-white/30",
                    )}
                  >
                    {/^\d+$/.test(num) ? `Bàn ${num}` : num}
                  </button>
                ))}
              </div>
              <input
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                placeholder="Nhập số bàn (VD: 3 hoặc VIP 1)"
                className="field"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              <p className="text-white/50">Link tự động nhúng vào mã QR:</p>
              <p className="mt-1 truncate font-mono text-white">{tableUrl}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(tableUrl).then(() => {
                      setCopiedLink(true);
                      toast("Đã sao chép link bàn!");
                      setTimeout(() => setCopiedLink(false), 1500);
                    });
                  }}
                  className="btn-ghost px-3 py-2 text-xs"
                >
                  {copiedLink ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
                  Sao chép link
                </button>

                <a
                  href={tableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost px-3 py-2 text-xs"
                >
                  <ExternalLink className="size-3.5" /> Mở thử bàn này
                </a>

                {qrStickerUrl && (
                  <a
                    href={qrStickerUrl}
                    download={`QR-Ban-${tableClean}.png`}
                    className="btn-primary px-3.5 py-2 text-xs"
                  >
                    <Download className="size-3.5" /> Tải nhãn QR (.PNG)
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[240px]">
            {qrStickerUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrStickerUrl}
                alt={`QR ${tableLabel}`}
                className="w-full rounded-2xl border border-white/15 shadow-2xl"
              />
            ) : (
              <div className="aspect-[720/920] w-full rounded-2xl skeleton" />
            )}
          </div>
        </div>
      </section>

      {/* ---------- 5. Cấu hình Ngân hàng & VietQR ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10">
            <Landmark className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              Tài khoản Ngân hàng nhận tiền (VietQR tự động)
            </h2>
            <p className="text-xs text-white/55">
              Tự động tạo mã VietQR điền sẵn đúng số tiền và mã đơn hàng cho khách quét.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Ngân hàng (Mã VietQR)</label>
            <select
              value={POPULAR_BANKS.some((b) => b.id === form.bank_id) ? form.bank_id : "CUSTOM"}
              onChange={(e) => {
                if (e.target.value !== "CUSTOM") {
                  setForm({ ...form, bank_id: e.target.value });
                }
              }}
              className="field bg-ink-900"
            >
              {POPULAR_BANKS.map((b) => (
                <option key={b.id} value={b.id} className="bg-ink-900 text-white">
                  {b.id} — {b.name}
                </option>
              ))}
              <option value="CUSTOM" className="bg-ink-900 text-white">
                Khác (Tự nhập mã NH)…
              </option>
            </select>
            <input
              value={form.bank_id}
              onChange={(e) => setForm({ ...form, bank_id: e.target.value.toUpperCase() })}
              placeholder="VD: MB, VCB, TCB…"
              className="field mt-2 py-2 text-xs uppercase"
            />
          </div>

          <div>
            <label className="label">Số tài khoản nhận tiền</label>
            <input
              value={form.bank_account_no}
              onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })}
              placeholder="VD: 0901234567"
              className="field font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="label">Tên chủ tài khoản (Không dấu)</label>
            <input
              value={form.bank_account_name}
              onChange={(e) => setForm({ ...form, bank_account_name: e.target.value.toUpperCase() })}
              placeholder="VD: NGUYEN VAN A"
              className="field uppercase"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-white/50">
            Xem trước mã VietQR (Thử nghiệm đơn #IND-001 • 35.000đ):
          </p>
          <VietQrCard settings={form} amount={35000} orderCode="#IND-001" />
        </div>
      </section>

      {/* ---------- 6. Zero-Trust Protection & Webhooks (SePay/Casso + Telegram) ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
              <Shield className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Zero-Trust Bảo mật, Telegram Bot &amp; Bank Webhook
              </h2>
              <p className="text-xs text-white/55">
                Chống boom hàng bằng chấm điểm rủi ro, tự xác nhận chuyển khoản qua SePay/Casso và duyệt đơn ngay trên Telegram.
              </p>
            </div>
          </div>

          <button
            id="telegram-test-btn"
            type="button"
            disabled={testingTelegram}
            onClick={() => void handleTestTelegram()}
            className="btn-ghost text-xs"
          >
            {testingTelegram ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Gửi tin nhắn Test Telegram
          </button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-xs font-semibold">🛡️ Bắt buộc VietQR cho đơn rủi ro cao</p>
              <p className="text-[11px] text-white/45">
                Điểm rủi ro ≥ 60 hoặc SĐT Blacklist tự động chuyển sang VietQR
              </p>
            </div>
            <Toggle
              checked={form.force_vietqr_high_risk}
              onChange={(v) => setForm({ ...form, force_vietqr_high_risk: v })}
              label="Bắt buộc VietQR khi rủi ro cao"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-xs font-semibold">Cho phép khách tự hủy đơn Chờ xác nhận</p>
              <p className="text-[11px] text-white/45">
                Chỉ hủy được khi chưa thanh toán &amp; bếp chưa bấm Đang nấu
              </p>
            </div>
            <Toggle
              checked={form.customer_cancel_enabled}
              onChange={(v) => setForm({ ...form, customer_cancel_enabled: v })}
              label="Cho phép khách tự hủy đơn"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Telegram Bot Token</label>
            <input
              value={form.telegram_bot_token}
              onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })}
              placeholder="VD: 7123456789:AAH..."
              className="field font-mono text-xs"
            />
          </div>
          <div>
            <label className="label">Telegram Chat ID</label>
            <input
              value={form.telegram_chat_id}
              onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
              placeholder="VD: 123456789 hoặc -100123456789"
              className="field font-mono text-xs"
            />
          </div>
          <div>
            <label className="label">Bank Webhook Secret (SePay / Casso)</label>
            <input
              value={form.bank_webhook_secret}
              onChange={(e) => setForm({ ...form, bank_webhook_secret: e.target.value })}
              placeholder="Endpoint: /api/webhooks/bank"
              className="field font-mono text-xs"
            />
          </div>
          <div>
            <label className="label">Telegram Webhook Secret (Nút bấm Inline)</label>
            <input
              value={form.telegram_webhook_secret}
              onChange={(e) => setForm({ ...form, telegram_webhook_secret: e.target.value })}
              placeholder="Endpoint: /api/webhooks/telegram"
              className="field font-mono text-xs"
            />
          </div>
        </div>
      </section>

      {/* ---------- 7. Bảo mật Mã PIN Admin ---------- */}
      <section className="card space-y-3 p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">Đổi mã PIN đăng nhập (/admin)</h2>
            <p className="text-xs text-white/55">
              Bỏ trống nếu bạn muốn giữ nguyên mã PIN hiện tại ({settings.admin_pin}).
            </p>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="label">Mã PIN mới (4 – 12 chữ số)</label>
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="Nhập mã PIN mới…"
            className="field font-mono tracking-widest"
          />
        </div>
      </section>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-3 z-30">
        <button
          id="save-settings-btn"
          type="submit"
          disabled={saving}
          className="btn-primary w-full py-4 text-sm shadow-2xl"
        >
          {saving ? <Loader2 className="size-4.5 animate-spin" /> : <Save className="size-4.5" />}
          {saving ? "Đang lưu cấu hình…" : "Lưu toàn bộ cấu hình quán"}
        </button>
      </div>
    </form>
  );
}
