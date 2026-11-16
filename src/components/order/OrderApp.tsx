"use client";

import {
  Clock,
  Phone,
  Search,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartBar } from "@/components/order/CartBar";
import { CheckoutSheet } from "@/components/order/CheckoutSheet";
import { OrderHistorySheet } from "@/components/order/OrderHistorySheet";
import { OrderStatusSheet } from "@/components/order/OrderStatusSheet";
import { ProductCard, ProductCardSkeleton } from "@/components/order/ProductCard";
import { ProductSheet } from "@/components/order/ProductSheet";
import { ReorderCard } from "@/components/order/ReorderCard";
import { ModeSwitch, StoreHeader } from "@/components/order/StoreHeader";
import { useMounted } from "@/components/ui/primitives";
import { Toaster, toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { lineTotal, useOrderStore, type CartItem, type OrderHistoryEntry } from "@/lib/store";
import { applyThemeToDocument, resolveEffectiveTheme } from "@/lib/theme";
import type { MenuResponse, Order, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderApp({ initialMenu }: { initialMenu?: MenuResponse | null }) {
  const router = useRouter();
  const mounted = useMounted();
  const tapRef = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({
    count: 0,
    timer: null,
  });

  const handleSecretAdminTap = () => {
    if (tapRef.current.timer) clearTimeout(tapRef.current.timer);
    tapRef.current.count += 1;
    if (tapRef.current.count >= 5) {
      tapRef.current.count = 0;
      router.push("/admin");
      return;
    }
    tapRef.current.timer = setTimeout(() => {
      tapRef.current.count = 0;
    }, 1800);
  };

  const [menu, setMenu] = useState<MenuResponse | null>(initialMenu ?? null);
  const [loadingMenu, setLoadingMenu] = useState(!initialMenu);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Active product for ProductSheet
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSession, setSheetSession] = useState(0);

  // Checkout & History sheets
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Order status / receipt sheet
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackedToken, setTrackedToken] = useState<string | undefined>(undefined);
  const [customerOrderCount, setCustomerOrderCount] = useState<number | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reorderDismissed, setReorderDismissed] = useState(false);

  // Store state (persisted in localStorage)
  const cart = useOrderStore((s) => s.cart);
  const mode = useOrderStore((s) => s.mode);
  const tableNumber = useOrderStore((s) => s.tableNumber);
  const lastOrder = useOrderStore((s) => s.lastOrder);
  const activeOrder = useOrderStore((s) => s.activeOrder);
  const customerThemeMode = useOrderStore((s) => s.customerThemeMode);
  const orderHistory = useOrderStore((s) => s.orderHistory);
  const productOrderCounts = useOrderStore((s) => s.productOrderCounts);

  const addItem = useOrderStore((s) => s.addItem);
  const addMany = useOrderStore((s) => s.addMany);
  const clearCart = useOrderStore((s) => s.clearCart);
  const setMode = useOrderStore((s) => s.setMode);
  const setTableNumber = useOrderStore((s) => s.setTableNumber);
  const setLastOrder = useOrderStore((s) => s.setLastOrder);
  const setActiveOrder = useOrderStore((s) => s.setActiveOrder);
  const setCustomerThemeMode = useOrderStore((s) => s.setCustomerThemeMode);
  const recordOrderInHistory = useOrderStore((s) => s.recordOrderInHistory);
  const updateOrderHistoryStatus = useOrderStore((s) => s.updateOrderHistoryStatus);

  const settings = menu?.settings ?? null;

  // Apply Store Theme + Customer Dark/Light Override dynamically
  useEffect(() => {
    applyThemeToDocument(settings, mounted ? customerThemeMode : "auto");
  }, [settings, customerThemeMode, mounted]);

  const effectiveTheme = useMemo(
    () => resolveEffectiveTheme(settings, mounted ? customerThemeMode : "auto"),
    [settings, customerThemeMode, mounted],
  );

  const handleToggleCustomerTheme = () => {
    const next = effectiveTheme.mode === "dark" ? "light" : "dark";
    setCustomerThemeMode(next);
  };

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
        setTrackedToken(activeOrder.trackingToken);
        updateOrderHistoryStatus(o.id, o.status);
        if (o.status === "COMPLETED" || o.status === "CANCELLED") {
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
  }, [mounted, activeOrder, trackedOrder?.id, setActiveOrder, updateOrderHistoryStatus]);

  const products = useMemo(() => menu?.products ?? [], [menu]);
  const toppings = useMemo(() => menu?.toppings ?? [], [menu]);
  const isOpen = settings?.is_open ?? true;

  // Dynamic categories (only shown when menu has >= 2 categories)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const cat = (p.category || "").trim();
      if (cat) set.add(cat);
    }
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categories.length >= 2 && activeCategory !== "ALL") {
        if ((p.category || "").trim() !== activeCategory) return false;
      }
      if (q && products.length > 8) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, search, categories.length, activeCategory]);

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

  const reorderCartItems = (itemsToRestore: CartItem[]) => {
    if (!isOpen) {
      toast("Quán đang tạm ngưng nhận đơn.", "error");
      return;
    }
    const productMap = new Map(products.map((p) => [p.id, p]));
    const toppingMap = new Map(toppings.map((t) => [t.id, t]));

    const validItems: Omit<CartItem, "lineId">[] = [];
    for (const oldItem of itemsToRestore) {
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
        spicyLevel: settings?.enable_spicy_level ? (oldItem.spicyLevel ?? 1) : null,
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
    toast("Đã thêm thực đơn lần trước vào giỏ!");
    setHistoryOpen(false);
    setCheckoutOpen(true);
  };

  const handleReorder = () => {
    if (!lastOrder) return;
    reorderCartItems(lastOrder.items);
  };

  const handleOrderPlaced = (order: Order, count: number | null) => {
    const itemsSnapshot = [...cart];
    if (itemsSnapshot.length > 0) {
      const snapTotal = itemsSnapshot.reduce((s, it) => s + lineTotal(it), 0);
      setLastOrder({
        code: order.order_code,
        items: itemsSnapshot,
        total: snapTotal,
      });
    }
    recordOrderInHistory({
      id: order.id,
      code: order.order_code,
      total: order.total_amount,
      status: order.status,
      payment_method: order.payment_method,
      order_type: order.order_type,
      items: itemsSnapshot,
      trackingToken: order.tracking_token,
      createdAt: order.created_at,
    });
    setActiveOrder({
      id: order.id,
      code: order.order_code,
      total: order.total_amount,
      payment_method: order.payment_method,
      trackingToken: order.tracking_token,
      createdAt: order.created_at,
    });
    clearCart();
    setCheckoutOpen(false);
    setTrackedOrder(order);
    setTrackedToken(order.tracking_token);
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
        setTrackedToken(activeOrder.trackingToken);
        setStatusOpen(true);
      } catch {
        toast("Không tìm thấy thông tin đơn hàng.", "error");
        setActiveOrder(null);
      }
    }
  };

  const handleTrackFromHistory = async (entry: OrderHistoryEntry) => {
    try {
      const o = await api<Order>(`/api/orders/${entry.id}`);
      setTrackedOrder(o);
      setTrackedToken(entry.trackingToken);
      updateOrderHistoryStatus(o.id, o.status);
      setHistoryOpen(false);
      setStatusOpen(true);
    } catch {
      toast("Không thể tải thông tin đơn hàng này.", "error");
    }
  };

  const trackingCode = mounted ? (trackedOrder?.order_code ?? activeOrder?.code ?? null) : null;
  const hotline = settings?.hotline?.trim() || "0327469961";
  const formattedHotline =
    hotline.length === 10
      ? `${hotline.slice(0, 4)} ${hotline.slice(4, 7)} ${hotline.slice(7)}`
      : hotline;
  const storeName = settings?.store_name || "Tiệm Mì Indomie";
  const storeHours = settings?.store_hours || "Mở cửa mỗi ngày";
  const menuTitle = settings?.menu_title || "Thực đơn Mì Trộn";
  const unitLabel = settings?.item_unit_label || "hộp";

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-32">
      <Toaster />

      {/* Minimalist Top Utilities (History / Theme Toggle / Active Order Pill) */}
      <StoreHeader
        settings={settings}
        trackingCode={trackingCode}
        onOpenTracking={handleOpenTracking}
        historyCount={mounted ? orderHistory.length : 0}
        onOpenHistory={() => setHistoryOpen(true)}
        effectiveMode={effectiveTheme.mode}
        onToggleTheme={handleToggleCustomerTheme}
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
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {storeName} hiện đang nghỉ hoặc quá tải đơn. Bạn vẫn có thể xem trước thực đơn và quay lại đặt sau ít phút nhé!
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
            unitLabel={unitLabel}
          />
        )}

        {/* 3.1 Segmented Control (Mode Switch) */}
        <ModeSwitch
          mode={mounted ? mode : "DINE_IN"}
          onChange={setMode}
          tableNumber={mounted ? tableNumber : undefined}
        />

        {/* Menu Header (Clean & Minimalist — 5 taps on title opens /admin) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <div
              onClick={handleSecretAdminTap}
              className="flex cursor-default select-none items-center gap-2.5"
            >
              <h1 className="text-lg font-bold tracking-tight text-fg">{menuTitle}</h1>
              {products.length > 0 && (
                <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-medium text-muted tabular-nums">
                  {products.length} món
                </span>
              )}
            </div>

            {products.length > 8 && (
              <div className="relative w-44 sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm món…"
                  aria-label="Tìm món"
                  className="w-full rounded-full border border-line bg-surface py-1.5 pr-7 pl-8 text-xs text-fg placeholder:text-subtle outline-none transition focus:border-line-strong focus:bg-surface-hover"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-subtle hover:text-fg"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category Filter Pills (shown only when >= 2 categories exist) */}
          {categories.length >= 2 && (
            <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory("ALL")}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  activeCategory === "ALL"
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
                )}
              >
                Tất cả
              </button>
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
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
            <UtensilsCrossed className="mx-auto size-8 text-subtle" />
            <p className="mt-3 text-sm font-semibold text-fg">Không tìm thấy món phù hợp</p>
            <p className="mt-1 text-xs text-muted">
              Thử từ khóa khác hoặc xem toàn bộ thực đơn nhé.
            </p>
            {(search || activeCategory !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActiveCategory("ALL");
                }}
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
                orderedTimes={mounted ? (productOrderCounts[product.id] ?? 0) : 0}
              />
            ))}
          </div>
        )}
      </main>

      {/* Minimalist Footer with Hotline Support (5 taps on store name also opens /admin) */}
      <footer className="mt-12 border-t border-line pt-6 text-center">
        <p
          onClick={handleSecretAdminTap}
          className="inline-block cursor-default select-none text-xs font-medium text-muted"
        >
          {storeName} • {storeHours}
          {settings?.store_address ? ` • ${settings.store_address}` : ""}
        </p>
        <div className="mt-3 flex justify-center">
          <a
            href={`tel:${hotline.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-medium text-fg/85 transition hover:border-line-strong hover:bg-surface-hover hover:text-fg active:scale-95"
          >
            <Phone className="size-3.5 text-muted" />
            <span>
              Hotline hỗ trợ / đặt món nhanh:{" "}
              <b className="font-semibold tracking-wide text-fg tabular-nums">
                {formattedHotline}
              </b>
            </span>
          </a>
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
        enableSpicyLevel={Boolean(settings?.enable_spicy_level)}
        unitLabel={unitLabel}
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
          products={products}
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
        trackingToken={trackedToken}
        settings={settings}
        onOrderUpdated={(updated) => {
          setTrackedOrder(updated);
          updateOrderHistoryStatus(updated.id, updated.status);
        }}
        onNewOrder={() => {
          setStatusOpen(false);
          setActiveOrder(null);
          setTrackedOrder(null);
          setTrackedToken(undefined);
          setCustomerOrderCount(null);
        }}
      />

      {/* Personal Order History Sheet */}
      <OrderHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={mounted ? orderHistory : []}
        unitLabel={unitLabel}
        onTrack={handleTrackFromHistory}
        onReorder={(entry) => reorderCartItems(entry.items)}
      />
    </div>
  );
}
