"use client";

import {
  ArrowLeft,
  ClipboardList,
  Database,
  EggFried,
  Loader2,
  Lock,
  LogOut,
  Settings,
  Soup,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MenuCrudTab } from "@/components/admin/MenuCrudTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { Toaster, toast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import type { StoreSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminTab = "orders" | "products" | "toppings" | "settings";

const TABS: {
  id: AdminTab;
  label: string;
  shortLabel: string;
  icon: typeof ClipboardList;
}[] = [
  { id: "orders", label: "1. Đơn hàng & Trạng thái", shortLabel: "Đơn hàng", icon: ClipboardList },
  { id: "products", label: "2. Món Chính", shortLabel: "Món chính", icon: Soup },
  { id: "toppings", label: "3. Topping", shortLabel: "Topping", icon: EggFried },
  { id: "settings", label: "4. Cấu hình & QR Bàn", shortLabel: "Cấu hình", icon: Settings },
];

export function AdminDashboard() {
  const [authState, setAuthState] = useState<"checking" | "locked" | "authenticated">("checking");
  const [pin, setPin] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [storageKind, setStorageKind] = useState<"local" | "supabase">("local");

  const loadSettings = useCallback(async () => {
    try {
      const res = await api<{ settings: StoreSettings; storage: "local" | "supabase" }>(
        "/api/admin/settings",
      );
      setSettings(res.settings);
      setStorageKind(res.storage);
      setAuthState("authenticated");
    } catch {
      setAuthState("locked");
    }
  }, []);

  useEffect(() => {
    let active = true;
    api<{ settings: StoreSettings; storage: "local" | "supabase" }>("/api/admin/settings")
      .then((res) => {
        if (!active) return;
        setSettings(res.settings);
        setStorageKind(res.storage);
        setAuthState("authenticated");
      })
      .catch(() => {
        if (active) setAuthState("locked");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoggingIn(true);
    try {
      await api("/api/admin/session", {
        method: "POST",
        json: { pin: pin.trim() },
      });
      setPin("");
      toast("🔓 Đăng nhập quản trị thành công!");
      await loadSettings();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await api("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    setAuthState("locked");
    setSettings(null);
    toast("Đã đăng xuất khỏi trang quản trị.");
  };

  if (authState === "checking") {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <Toaster />
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Loader2 className="size-7 animate-spin" />
          <p className="text-sm">Đang kiểm tra phiên đăng nhập…</p>
        </div>
      </div>
    );
  }

  if (authState === "locked" || !settings) {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <Toaster />
        <div className="card animate-rise w-full max-w-sm p-6 sm:p-7">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-black shadow-lg">
            <Lock className="size-6" />
          </div>
          <h1 className="mt-4 text-center text-xl font-bold tracking-tight">
            Quản trị Tiệm Mì Indomie
          </h1>
          <p className="mt-1 text-center text-xs text-white/55">
            Nhập mã PIN chủ quán để quản lý đơn hàng, thực đơn &amp; cấu hình.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-pin-input" className="label text-center">
                Mã PIN bảo mật
              </label>
              <input
                id="admin-pin-input"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="••••••"
                className="field text-center font-mono text-2xl tracking-[0.4em]"
              />
            </div>

            {/* Quick numeric keypad for mobile/tablet touch convenience */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "C") setPin("");
                    else if (key === "⌫") setPin((p) => p.slice(0, -1));
                    else setPin((p) => (p + key).slice(0, 12));
                  }}
                  className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-base font-bold text-white transition hover:bg-white/10 active:scale-95"
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={loggingIn || pin.length < 4}
              className="btn-primary w-full py-3.5 text-sm"
            >
              {loggingIn ? <Loader2 className="size-4 animate-spin" /> : null}
              {loggingIn ? "Đang xác thực…" : "Mở trang Quản trị"}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-white/40">
            Mã PIN mặc định trải nghiệm:{" "}
            <button
              type="button"
              onClick={() => setPin("123456")}
              className="cursor-pointer font-mono font-bold text-white/75 underline underline-offset-2 hover:text-white"
            >
              123456
            </button>
          </p>

          <div className="mt-5 border-t border-white/10 pt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white/55 hover:text-white"
            >
              <ArrowLeft className="size-3.5" /> Quay về trang đặt món của khách
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-4 pb-20">
      <Toaster />

      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/10 bg-ink-950/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-lg text-black shadow">
              🍜
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight sm:text-lg">
                  {settings.store_name} — Admin
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/65">
                  <Database className="size-3" />
                  {storageKind === "supabase" ? "Supabase DB" : "Local Hybrid DB"}
                </span>
              </div>
              <p className="text-xs text-white/45">
                 Quản lý đơn trực tiếp, món chính, topping, VietQR &amp; Telegram Bot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/" className="btn-ghost px-3 py-2 text-xs">
              <ArrowLeft className="size-3.5" /> Xem Web Khách
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost px-3 py-2 text-xs text-white/65 hover:text-danger"
              title="Đăng xuất"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Thoát</span>
            </button>
          </div>
        </div>

        {/* 4-Tab Navigation Bar */}
        <nav
          aria-label="Các mục quản trị"
          className="no-scrollbar mt-3 grid grid-cols-4 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition",
                  active
                    ? "bg-white text-black shadow-md"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate sm:hidden">{tab.shortLabel}</span>
                <span className="hidden truncate sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Active Tab Content */}
      <main>
        {activeTab === "orders" && (
          <OrdersTab settings={settings} onSettingsChanged={setSettings} />
        )}
        {activeTab === "products" && <MenuCrudTab key="products" kind="products" />}
        {activeTab === "toppings" && <MenuCrudTab key="toppings" kind="toppings" />}
        {activeTab === "settings" && (
          <SettingsTab settings={settings} onSettingsChanged={setSettings} />
        )}
      </main>
    </div>
  );
}

