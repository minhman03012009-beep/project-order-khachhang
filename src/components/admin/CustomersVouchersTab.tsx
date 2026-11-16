"use client";

import {
  Ban,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Toggle } from "@/components/ui/primitives";
import { toast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import type { Customer, StoreSettings, VoucherRule } from "@/lib/types";
import { cn, formatVND, isValidPhone } from "@/lib/utils";

interface CustomersVouchersTabProps {
  settings: StoreSettings;
  onSettingsChanged: (next: StoreSettings) => void;
}

export function CustomersVouchersTab({
  settings,
  onSettingsChanged,
}: CustomersVouchersTabProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // New voucher form
  const [vCode, setVCode] = useState("");
  const [vDiscount, setVDiscount] = useState(15000);
  const [vMinOrder, setVMinOrder] = useState(100000);
  const [savingVouchers, setSavingVouchers] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ customers: Customer[] }>("/api/admin/customers")
      .then((res) => {
        if (active) setCustomers(res.customers);
      })
      .catch((e) => {
        if (active) toast(errorMessage(e), "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const vouchers = settings.vouchers ?? [];

  const saveVouchers = async (next: VoucherRule[], okMsg: string) => {
    setSavingVouchers(true);
    try {
      const res = await api<{ settings: StoreSettings }>("/api/admin/settings", {
        method: "PUT",
        json: { vouchers: next },
      });
      onSettingsChanged(res.settings);
      toast(okMsg);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSavingVouchers(false);
    }
  };

  const handleAddVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = vCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (clean.length < 3) {
      toast("Mã giảm giá cần ít nhất 3 ký tự (chữ/số).", "error");
      return;
    }
    if (vouchers.some((v) => v.code.toUpperCase() === clean)) {
      toast("Mã giảm giá này đã tồn tại.", "error");
      return;
    }
    const next: VoucherRule[] = [
      ...vouchers,
      {
        code: clean,
        discount_amount: Math.max(1000, vDiscount),
        min_order_amount: Math.max(0, vMinOrder),
        is_active: true,
        description: `Giảm ${formatVND(vDiscount)} cho đơn từ ${formatVND(vMinOrder)}`,
      },
    ];
    await saveVouchers(next, `🎟️ Đã tạo mã ${clean}!`);
    setVCode("");
  };

  const handleToggleBlacklist = async (phone: string, nextVal: boolean) => {
    try {
      const res = await api<{ customer: Customer; blacklisted_phones: string[] }>(
        "/api/admin/customers",
        {
          method: "PATCH",
          json: { phone, is_blacklisted: nextVal },
        },
      );
      setCustomers((cur) => {
        const exists = cur.some((c) => c.phone === phone);
        return exists
          ? cur.map((c) => (c.phone === phone ? res.customer : c))
          : [res.customer, ...cur];
      });
      onSettingsChanged({ ...settings, blacklisted_phones: res.blacklisted_phones });
      toast(
        nextVal
          ? `🚫 Đã chặn SĐT ${phone} (Bắt buộc VietQR nếu đặt lại)`
          : `✅ Đã gỡ chặn SĐT ${phone}`,
      );
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.phone.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      {/* ---------- 1. Voucher Manager ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10">
            <Tag className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              Quản lý Mã giảm giá / Voucher ({vouchers.length})
            </h2>
            <p className="text-xs text-white/55">
              Khách chọn nhanh ngay trong giỏ hàng; giá giảm được kiểm tra &amp; tính an toàn tại Server.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddVoucher} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:grid-cols-4">
          <div>
            <label className="label">Mã Code</label>
            <input
              value={vCode}
              onChange={(e) => setVCode(e.target.value.toUpperCase())}
              placeholder="VD: GIAM20K"
              className="field py-2.5 text-xs font-bold uppercase"
            />
          </div>
          <div>
            <label className="label">Số tiền giảm (đ)</label>
            <input
              type="number"
              step={1000}
              min={1000}
              value={vDiscount}
              onChange={(e) => setVDiscount(Number(e.target.value) || 0)}
              className="field py-2.5 text-xs font-bold tabular-nums"
            />
          </div>
          <div>
            <label className="label">Đơn tối thiểu (đ)</label>
            <input
              type="number"
              step={10000}
              min={0}
              value={vMinOrder}
              onChange={(e) => setVMinOrder(Number(e.target.value) || 0)}
              className="field py-2.5 text-xs font-bold tabular-nums"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={savingVouchers}
              className="btn-primary w-full py-2.5 text-xs"
            >
              <Plus className="size-4" /> Thêm mã
            </button>
          </div>
        </form>

        {vouchers.length === 0 ? (
          <p className="text-center text-xs text-white/45">Chưa có mã giảm giá nào.</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {vouchers.map((v) => (
              <div
                key={v.code}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border p-3.5",
                  v.is_active
                    ? "border-white/15 bg-white/[0.04]"
                    : "border-white/10 bg-white/[0.02] opacity-55",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-extrabold text-black">
                      {v.code}
                    </span>
                    <span className="text-sm font-bold text-ok">
                      -{formatVND(v.discount_amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/55">
                    Áp dụng cho đơn từ {formatVND(v.min_order_amount)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Toggle
                    checked={v.is_active}
                    onChange={(on) =>
                      void saveVouchers(
                        vouchers.map((x) => (x.code === v.code ? { ...x, is_active: on } : x)),
                        `${v.code}: ${on ? "Đã bật" : "Đã tắt"}`,
                      )
                    }
                    label={`Bật/tắt mã ${v.code}`}
                  />
                  <button
                    type="button"
                    aria-label={`Xóa mã ${v.code}`}
                    onClick={() =>
                      void saveVouchers(
                        vouchers.filter((x) => x.code !== v.code),
                        `Đã xóa mã ${v.code}`,
                      )
                    }
                    className="grid size-8 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 text-white/45 hover:border-danger/40 hover:bg-danger/15 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- 2. Customer CRM & Zero-Trust Blacklist ---------- */}
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-white/10">
              <Users className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Khách hàng thân thiết &amp; Chống Boom hàng ({customers.length})
              </h2>
              <p className="text-xs text-white/55">
                Khách đặt nhiều tự động gắn nhãn Khách quen; SĐT bị chặn sẽ chấm điểm rủi ro 100/100.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm SĐT, tên, địa chỉ…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-2 pr-3 pl-9 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/35"
            />
          </div>
        </div>

        {/* Quick Blacklist Phone input */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-danger/25 bg-danger/5 p-3">
          <ShieldAlert className="size-4 shrink-0 text-danger" />
          <input
            type="tel"
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Nhập SĐT muốn chặn (VD: 0912345678)"
            className="field flex-1 min-w-[180px] py-2 text-xs tabular-nums"
          />
          <button
            type="button"
            disabled={!isValidPhone(manualPhone)}
            onClick={() => {
              void handleToggleBlacklist(manualPhone, true);
              setManualPhone("");
            }}
            className="btn-danger px-3.5 py-2 text-xs"
          >
            <Ban className="size-3.5" /> Thêm vào Blacklist
          </button>
        </div>

        {loading ? (
          <div className="h-32 rounded-2xl skeleton" />
        ) : filteredCustomers.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/45">
            Chưa có dữ liệu khách hàng (tự động lưu khi có đơn mới kèm SĐT).
          </p>
        ) : (
          <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
            {filteredCustomers.map((c) => {
              const vip = c.total_orders >= 3 && !c.is_blacklisted;
              return (
                <div
                  key={c.phone}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white tabular-nums">
                        {c.phone}
                      </span>
                      {c.name && <span className="font-semibold text-white/80">• {c.name}</span>}
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">
                        {c.total_orders} đơn
                      </span>
                      {vip && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-bold text-ok">
                          <ShieldCheck className="size-3" /> Khách quen
                        </span>
                      )}
                      {c.is_blacklisted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger/20 px-2 py-0.5 text-[11px] font-bold text-danger">
                          <Ban className="size-3" /> Bị chặn (Blacklist)
                        </span>
                      )}
                    </div>
                    {c.address && <p className="truncate text-white/50">📍 {c.address}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleToggleBlacklist(c.phone, !c.is_blacklisted)}
                    className={cn(
                      "cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                      c.is_blacklisted
                        ? "border-ok/40 bg-ok/15 text-ok hover:bg-ok/25"
                        : "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
                    )}
                  >
                    {c.is_blacklisted ? "Gỡ chặn" : "Chặn boom"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

