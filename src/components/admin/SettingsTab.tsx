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
  QrCode,
  Save,
  Send,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";
import { generateTableQrStickerDataUrl } from "@/components/admin/image-utils";
import { VietQrCard } from "@/components/order/VietQrCard";
import { toast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
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

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const tableClean = tableInput.trim() || "1";
  const tableLabel = /^\d+$/.test(tableClean) ? `Bàn số ${tableClean}` : tableClean;
  const tableUrl = `${origin}/?table=${encodeURIComponent(tableClean)}`;

  // Generate QR sticker whenever tableInput or store_name changes
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
      setNewPin("");
      toast("💾 Đã lưu toàn bộ cấu hình quán!");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      {/* ---------- 1. Công cụ Tạo Mã QR Đặt Món Cho Từng Bàn ---------- */}
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
                  <ExternalLink className="size-3.5" /> Mở thử giao diện bàn này
                </a>

                {qrStickerUrl && (
                  <a
                    href={qrStickerUrl}
                    download={`QR-Ban-${tableClean}.png`}
                    className="btn-primary px-3.5 py-2 text-xs"
                  >
                    <Download className="size-3.5" /> Tải nhãn QR in dán bàn (.PNG)
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

      {/* ---------- 2. Thông tin Quán, Tọa độ GPS & Phí Ship ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10">
            <Store className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              Thông tin Quán, Định vị GPS &amp; Giao hàng
            </h2>
            <p className="text-xs text-white/55">
              Dùng công thức Haversine tính khoảng cách từ khách tới quán không cần bản đồ nặng.
            </p>
          </div>
        </div>

        <div>
          <label className="label">Tên tiệm hiển thị trên Header &amp; Hóa đơn</label>
          <input
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
            placeholder="Tiệm Mì Indomie"
            className="field"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
              <MapPin className="size-4 text-ok" /> Tọa độ GPS của quán
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

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vĩ độ (store_lat)</label>
              <input
                type="number"
                step="any"
                value={form.store_lat}
                onChange={(e) => setForm({ ...form, store_lat: Number(e.target.value) })}
                className="field text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="label">Kinh độ (store_lng)</label>
              <input
                type="number"
                step="any"
                value={form.store_lng}
                onChange={(e) => setForm({ ...form, store_lng: Number(e.target.value) })}
                className="field text-xs tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Bán kính giao hàng tối đa (km)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.max_delivery_km}
              onChange={(e) => setForm({ ...form, max_delivery_km: Number(e.target.value) })}
              className="field tabular-nums"
            />
            <p className="mt-1 text-[11px] text-white/40">
              Nhập 0 nếu không giới hạn khoảng cách.
            </p>
          </div>
          <div>
            <label className="label">Phí ship mỗi km (VNĐ / km)</label>
            <input
              type="number"
              step="1000"
              min="0"
              value={form.shipping_fee_per_km}
              onChange={(e) =>
                setForm({ ...form, shipping_fee_per_km: Math.max(0, Number(e.target.value)) })
              }
              className="field tabular-nums"
            />
            <p className="mt-1 text-[11px] text-white/40">
              Nhập 0 nếu quán miễn phí giao hàng (Freeship).
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 3. Cấu hình Ngân hàng & VietQR ---------- */}
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
              value={
                POPULAR_BANKS.some((b) => b.id === form.bank_id) ? form.bank_id : "CUSTOM"
              }
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
              onChange={(e) =>
                setForm({ ...form, bank_account_name: e.target.value.toUpperCase() })
              }
              placeholder="VD: NGUYEN VAN A"
              className="field uppercase"
            />
          </div>
        </div>

        {/* Live VietQR Preview */}
        <div>
          <p className="mb-2 text-xs font-medium text-white/50">
            Xem trước mã VietQR (Thử nghiệm đơn #IND-001 • 35.000đ):
          </p>
          <VietQrCard
            settings={form}
            amount={35000}
            orderCode="#IND-001"
          />
        </div>
      </section>

      {/* ---------- 4. Cấu hình Telegram Bot Báo Đơn Tức Thì ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
              <Send className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Telegram Bot nhận đơn về điện thoại
              </h2>
              <p className="text-xs text-white/55">
                Bắn thông báo đơn mới kèm link gọi điện &amp; Google Maps chỉ đường ngay khi khách chốt đơn.
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
            Gửi tin nhắn Test về điện thoại
          </button>
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
            <label className="label">Telegram Chat ID (Của bạn hoặc Nhóm bếp)</label>
            <input
              value={form.telegram_chat_id}
              onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
              placeholder="VD: 123456789 hoặc -100123456789"
              className="field font-mono text-xs"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-white/50">
          💡 <b>Mẹo lấy nhanh trong 1 phút:</b> Mở Telegram tìm <b>@BotFather</b> → gõ{" "}
          <code>/newbot</code> để lấy <b>Bot Token</b> (nhớ bấm Start với bot vừa tạo). Sau đó tìm{" "}
          <b>@userinfobot</b> → bấm Start để lấy <b>Id</b> điền vào ô Chat ID.
        </div>
      </section>

      {/* ---------- 5. Bảo mật Mã PIN Admin ---------- */}
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

