"use client";

import {
  Clock,
  Flame,
  Lock,
  Search,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartBar } from "@/components/order/CartBar";
import { CheckoutSheet } from "@/components/order/CheckoutSheet";
import { OrderStatusSheet } from "@/components/order/OrderStatusSheet";
import { ProductCard, ProductCardSkeleton } from "@/components/order/ProductCard";
import { ProductSheet } from "@/components/order/ProductSheet";
import { ReorderCard } from "@/components/order/ReorderCard";
import { ModeSwitch, StoreHeader } from "@/components/order/StoreHeader";
import { useMounted } from "@/components/ui/primitives";
import { Toaster, toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { lineTotal, useOrderStore, type CartItem } from "@/lib/store";
import type { MenuResponse, Order, Product } from "@/lib/types";
import { formatVND } from "@/lib/utils";

export function OrderApp({ initialMenu }: { initialMenu?: MenuResponse | null }) {
  const mounted = useMounted();

  const [menu, setMenu] = useState<MenuResponse | null>(initialMenu ?? null);
  const [loadingMenu, setLoadingMenu] = useState(!initialMenu);
  const [search, setSearch] = useState("");

  // Active product for ProductSheet
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSession, setSheetSession] = useState(0);

  // Checkout sheet
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Order status / receipt sheet
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [customerOrderCount, setCustomerOrderCount] = useState<number | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reorderDismissed, setReorderDismissed] = useState(false);

  // Store state (persisted in localStorage)
  const cart = useOrderStore((s) => s.cart);
  const mode = useOrderStore((s) => s.mode);
  const tableNumber = useOrderStore((s) => s.tableNumber);
  const lastOrder = useOrderStore((s) => s.lastOrder);
  const activeOrder = useOrderStore((s) => s.activeOrder);
  const addItem = useOrderStore((s) => s.addItem);
  const addMany = useOrderStore((s) => s.addMany);
  const clearCart = useOrderStore((s) => s.clearCart);
  const setMode = useOrderStore((s) => s.setMode);
  const setTableNumber = useOrderStore((s) => s.setTableNumber);
  const setLastOrder = useOrderStore((s) => s.setLastOrder);
  const setActiveOrder = useOrderStore((s) => s.setActiveOrder);

  const refreshMenu = useCallback(async () => {
    try {
      const fresh = await api<MenuResponse>("/api/menu");
      setMenu(fresh);
    } catch {
      /* keep existing menu if offline */
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  // Fetch latest menu on mount & when tab regains focus
  useEffect(() => {
    const sync = () => {
      api<MenuResponse>("/api/menu")
        .then((fresh) => setMenu(fresh))
        .catch(() => undefined)
        .finally(() => setLoadingMenu(false));
    };
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  // Detect ?table=X from QR scan URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawTable = params.get("table")?.trim();
    if (!rawTable) return;
    const formatted = /^\d+$/.test(rawTable) ? `Bàn số ${rawTable}` : rawTable;
    setMode("DINE_IN");
    setTableNumber(formatted);
    toast(`📍 Đã tự động chọn ${formatted}`);
  }, [setMode, setTableNumber]);

  // Hydrate activeOrder tracking details from server if available
  useEffect(() => {
    if (!mounted || !activeOrder?.id || trackedOrder?.id === activeOrder.id) return;
    let cancelled = false;
    api<Order>(`/api/orders/${activeOrder.id}`)
      .then((o) => {
        if (cancelled) return;
        setTrackedOrder(o);
        if (o.status === "COMPLETED" || o.status === "CANCELLED") {
          // Keep trackedOrder in memory for viewing, but clear active badge if older than 2 hours
          const ageMs = Date.now() - new Date(o.created_at).getTime();
          if (ageMs > 2 * 60 * 60 * 1000) setActiveOrder(null);
        }
      })
      .catch(() => {
        if (!cancelled) setActiveOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, activeOrder, trackedOrder?.id, setActiveOrder]);

  const settings = menu?.settings ?? null;
  const products = useMemo(() => menu?.products ?? [], [menu]);
  const toppings = useMemo(() => menu?.toppings ?? [], [menu]);
  const isOpen = settings?.is_open ?? true;

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [products, search]);

  // Cart totals & per-product counts
  const cartCount = mounted ? cart.reduce((s, it) => s + it.quantity, 0) : 0;
  const cartTotal = mounted ? cart.reduce((s, it) => s + lineTotal(it), 0) : 0;
  const qtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    if (!mounted) return map;
    for (const item of cart) {
      map[item.productId] = (map[item.productId] ?? 0) + item.quantity;
    }
    return map;
  }, [cart, mounted]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSheetSession((n) => n + 1);
    setSheetOpen(true);
  };

  const handleAddItem = (item: Omit<CartItem, "lineId">) => {
    addItem(item);
    setSheetOpen(false);
    toast(`Đã thêm ${item.quantity}× ${item.productName}`);
  };

  const handleReorder = () => {
    if (!lastOrder) return;
    if (!isOpen) {
      toast("Quán đang tạm ngưng nhận đơn.", "error");
      return;
    }
    const productMap = new Map(products.map((p) => [p.id, p]));
    const toppingMap = new Map(toppings.map((t) => [t.id, t]));

    const validItems: Omit<CartItem, "lineId">[] = [];
    for (const oldItem of lastOrder.items) {
      const liveProd = productMap.get(oldItem.productId);
      if (!liveProd || !liveProd.is_available) continue;
      const liveTops = oldItem.toppings
        .map((t) => {
          const lt = toppingMap.get(t.id);
          return lt && lt.is_available
            ? { id: lt.id, name: lt.name, price: lt.price, quantity: t.quantity }
            : null;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      validItems.push({
        productId: liveProd.id,
        productName: liveProd.name,
        image_url: liveProd.image_url,
        basePrice: liveProd.price,
        quantity: oldItem.quantity,
        toppings: liveTops,
        quickTags: oldItem.quickTags,
        itemNote: oldItem.itemNote,
      });
    }

    if (validItems.length === 0) {
      toast("Các món trong đơn cũ hiện đã tạm hết.", "error");
      return;
    }

    addMany(validItems);
    toast("🍜 Đã thêm thực đơn lần trước vào giỏ!");
    setCheckoutOpen(true);
  };

  const handleOrderPlaced = (order: Order, count: number | null) => {
    // Save snapshot for 1-click reorder next time
    if (cart.length > 0) {
      const snapTotal = cart.reduce((s, it) => s + lineTotal(it), 0);
      setLastOrder({
        code: order.order_code,
        items: cart,
        total: snapTotal,
      });
    }
    setActiveOrder({
      id: order.id,
      code: order.order_code,
      total: order.total_amount,
      payment_method: order.payment_method,
      createdAt: order.created_at,
    });
    clearCart();
    setCheckoutOpen(false);
    setTrackedOrder(order);
    setCustomerOrderCount(count);
    setStatusOpen(true);
    toast(`🎉 Đặt đơn ${order.order_code} thành công!`);
  };

  const handleOpenTracking = async () => {
    if (trackedOrder) {
      setStatusOpen(true);
      return;
    }
    if (activeOrder?.id) {
      try {
        const o = await api<Order>(`/api/orders/${activeOrder.id}`);
        setTrackedOrder(o);
        setStatusOpen(true);
      } catch {
        toast("Không tìm thấy thông tin đơn hàng.", "error");
        setActiveOrder(null);
      }
    }
  };

  const trackingCode = mounted ? (trackedOrder?.order_code ?? activeOrder?.code ?? null) : null;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-32">
      <Toaster />

      {/* 3.1 Header */}
      <StoreHeader
        settings={settings}
        trackingCode={trackingCode}
        onOpenTracking={handleOpenTracking}
      />

      <main className="space-y-4">
        {/* Store Closed Banner */}
        {settings && !settings.is_open && (
          <div className="animate-rise flex items-start gap-3 rounded-3xl border border-danger/35 bg-danger/10 p-4 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-danger/20 text-danger">
              <Clock className="size-4.5" />
            </span>
            <div>
              <p className="font-bold text-danger">Quán đang tạm ngưng nhận đơn</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/65">
                Tiệm Mì Indomie hiện đang nghỉ hoặc quá tải đơn. Bạn vẫn có thể xem trước thực đơn và quay lại đặt sau ít phút nhé!
              </p>
            </div>
          </div>
        )}

        {/* 3.1 1-Click Reorder Card */}
        {mounted && lastOrder && !reorderDismissed && (
          <ReorderCard
            snapshot={lastOrder}
            onReorder={handleReorder}
            onDismiss={() => setReorderDismissed(true)}
          />
        )}

        {/* 3.1 Segmented Control (Mode Switch) */}
        <ModeSwitch
          mode={mounted ? mode : "DINE_IN"}
          onChange={setMode}
          tableNumber={mounted ? tableNumber : undefined}
        />

        {/* Quick Search & Menu Header */}
        <div className="pt-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Flame className="size-4.5 text-white/80" />
              <h1 className="text-lg font-bold tracking-tight">Thực đơn Mì Trộn</h1>
              {products.length > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60 tabular-nums">
                  {products.length} món
                </span>
              )}
            </div>

            {products.length > 3 && (
              <div className="relative w-44 sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/40" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm món mì…"
                  aria-label="Tìm món mì"
                  className="w-full rounded-full border border-white/10 bg-white/[0.04] py-1.5 pr-7 pl-8 text-xs text-white placeholder:text-white/35 outline-none transition focus:border-white/35 focus:bg-white/[0.08]"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Available Toppings Preview Strip */}
          {toppings.length > 0 && (
            <div className="no-scrollbar -mx-4 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-4 pb-1">
              <span className=" inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                <Sparkles className="size-3" /> {toppings.length} Topping tự chọn:
              </span>
              {toppings.map((t) => (
                <span
                  key={t.id}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60"
                >
                  {t.name} <b className="text-white/80">+{formatVND(t.price)}</b>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 3.2 Menu Grid */}
        {loadingMenu ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="card py-12 text-center">
            <UtensilsCrossed className="mx-auto size-8 text-white/30" />
            <p className="mt-3 text-sm font-semibold">Không tìm thấy món phù hợp</p>
            <p className="mt-1 text-xs text-white/45">
              Thử từ khóa khác hoặc xem toàn bộ thực đơn nhé.
            </p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="btn-ghost mt-4 px-4 py-2 text-xs"
              >
                Xem tất cả món
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onSelect={handleSelectProduct}
                disabled={!isOpen}
                inCartQty={qtyByProduct[product.id] ?? 0}
              />
            ))}
          </div>
        )}
      </main>

      {/* Subtle footer with Admin link */}
      <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/35">
        <p>{settings?.store_name ?? "Tiệm Mì Indomie"} • Đặt món siêu tốc Zero-Lag</p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-white/40 transition hover:text-white/80"
          >
            <Lock className="size-3" /> Quản trị quán (/admin)
          </Link>
        </div>
      </footer>

      {/* 3.3 Product Customization Bottom Sheet */}
      <ProductSheet
        open={sheetOpen}
        sessionKey={sheetSession}
        product={selectedProduct}
        toppings={toppings}
        onClose={() => setSheetOpen(false)}
        onAdd={handleAddItem}
        disabled={!isOpen}
      />

      {/* 3.4 Floating Cart Bar */}
      <CartBar
        count={cartCount}
        total={cartTotal}
        onOpen={() => setCheckoutOpen(true)}
        closed={!isOpen}
      />

      {/* 3.4 Checkout Bottom Sheet */}
      {settings && (
        <CheckoutSheet
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          settings={settings}
          onPlaced={handleOrderPlaced}
          onMenuStale={() => void refreshMenu()}
        />
      )}

      {/* 5.4 Order Receipt & Live Status Tracking Sheet */}
      <OrderStatusSheet
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        order={trackedOrder}
        customerOrderCount={customerOrderCount}
        settings={settings}
        onOrderUpdated={setTrackedOrder}
        onNewOrder={() => {
          setStatusOpen(false);
          setActiveOrder(null);
          setTrackedOrder(null);
          setCustomerOrderCount(null);
        }}
      />
    </div>
  );
}

