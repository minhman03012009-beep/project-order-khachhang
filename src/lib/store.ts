"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  OrderStatus,
  OrderTopping,
  OrderType,
  PaymentMethod,
  SavedAddressItem,
  ThemeMode,
} from "./types";

export interface CartItem {
  lineId: string;
  productId: string;
  productName: string;
  image_url: string;
  basePrice: number;
  quantity: number;
  spicyLevel?: number | null;
  toppings: OrderTopping[];
  quickTags: string[];
  itemNote: string;
}

export interface SavedCustomer {
  name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface LastOrderSnapshot {
  code: string;
  items: CartItem[];
  total: number;
}

export interface OrderHistoryEntry {
  id: string;
  code: string;
  total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  order_type: OrderType;
  items: CartItem[];
  trackingToken?: string;
  createdAt: string;
}

export interface ActiveOrder {
  id: string;
  code: string;
  total: number;
  payment_method: PaymentMethod;
  trackingToken?: string;
  createdAt: string;
}

export const unitPrice = (it: Pick<CartItem, "basePrice" | "toppings">) =>
  it.basePrice + it.toppings.reduce((s, t) => s + t.price * t.quantity, 0);

export const lineTotal = (it: CartItem) => unitPrice(it) * it.quantity;

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Two lines are "the same" if product, spicyLevel, toppings and notes match → merge quantity. */
const signature = (it: Omit<CartItem, "lineId" | "quantity">) =>
  JSON.stringify([
    it.productId,
    it.spicyLevel ?? null,
    [...it.toppings].sort((a, b) => a.id.localeCompare(b.id)).map((t) => [t.id, t.quantity]),
    [...it.quickTags].sort(),
    it.itemNote.trim(),
  ]);

interface OrderState {
  cart: CartItem[];
  mode: OrderType;
  tableNumber: string;
  customer: SavedCustomer;
  lastOrder: LastOrderSnapshot | null;
  activeOrder: ActiveOrder | null;

  // Personalization
  customerThemeMode: "auto" | ThemeMode;
  savedAddresses: SavedAddressItem[];
  orderHistory: OrderHistoryEntry[];
  productOrderCounts: Record<string, number>;

  addItem: (item: Omit<CartItem, "lineId">) => void;
  addMany: (items: Omit<CartItem, "lineId">[]) => void;
  setQty: (lineId: string, qty: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  setMode: (mode: OrderType) => void;
  setTableNumber: (table: string) => void;
  setCustomer: (patch: Partial<SavedCustomer>) => void;
  setLastOrder: (snap: LastOrderSnapshot | null) => void;
  setActiveOrder: (order: ActiveOrder | null) => void;

  setCustomerThemeMode: (mode: "auto" | ThemeMode) => void;
  addSavedAddress: (addr: Omit<SavedAddressItem, "id">) => void;
  removeSavedAddress: (id: string) => void;
  recordOrderInHistory: (entry: OrderHistoryEntry) => void;
  updateOrderHistoryStatus: (id: string, status: OrderStatus) => void;
}

function merge(cart: CartItem[], incoming: Omit<CartItem, "lineId">): CartItem[] {
  const sig = signature(incoming);
  const idx = cart.findIndex((c) => signature(c) === sig);
  if (idx >= 0) {
    const next = [...cart];
    next[idx] = { ...next[idx], quantity: Math.min(50, next[idx].quantity + incoming.quantity) };
    return next;
  }
  return [...cart, { ...incoming, lineId: uid() }];
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      cart: [],
      mode: "DINE_IN",
      tableNumber: "",
      customer: { name: "", phone: "", address: "", lat: null, lng: null },
      lastOrder: null,
      activeOrder: null,

      customerThemeMode: "auto",
      savedAddresses: [],
      orderHistory: [],
      productOrderCounts: {},

      addItem: (item) => set((s) => ({ cart: merge(s.cart, item) })),
      addMany: (items) => set((s) => ({ cart: items.reduce(merge, s.cart) })),
      setQty: (lineId, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter((c) => c.lineId !== lineId)
              : s.cart.map((c) =>
                  c.lineId === lineId ? { ...c, quantity: Math.min(50, qty) } : c,
                ),
        })),
      removeItem: (lineId) => set((s) => ({ cart: s.cart.filter((c) => c.lineId !== lineId) })),
      clearCart: () => set({ cart: [] }),
      setMode: (mode) => set({ mode }),
      setTableNumber: (tableNumber) => set({ tableNumber }),
      setCustomer: (patch) => set((s) => ({ customer: { ...s.customer, ...patch } })),
      setLastOrder: (lastOrder) => set({ lastOrder }),
      setActiveOrder: (activeOrder) => set({ activeOrder }),

      setCustomerThemeMode: (customerThemeMode) => set({ customerThemeMode }),
      addSavedAddress: (addr) =>
        set((s) => {
          const clean = addr.address.trim();
          if (!clean) return s;
          const filtered = s.savedAddresses.filter(
            (a) => a.address.toLowerCase() !== clean.toLowerCase(),
          );
          return {
            savedAddresses: [{ ...addr, id: uid(), address: clean }, ...filtered].slice(0, 6),
          };
        }),
      removeSavedAddress: (id) =>
        set((s) => ({ savedAddresses: s.savedAddresses.filter((a) => a.id !== id) })),
      recordOrderInHistory: (entry) =>
        set((s) => {
          const counts = { ...s.productOrderCounts };
          for (const it of entry.items) {
            counts[it.productId] = (counts[it.productId] ?? 0) + it.quantity;
          }
          const nextHistory = [
            entry,
            ...s.orderHistory.filter((h) => h.id !== entry.id),
          ].slice(0, 15);
          return {
            orderHistory: nextHistory,
            productOrderCounts: counts,
          };
        }),
      updateOrderHistoryStatus: (id, status) =>
        set((s) => ({
          orderHistory: s.orderHistory.map((h) => (h.id === id ? { ...h, status } : h)),
        })),
    }),
    {
      name: "indomie-order-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        cart: s.cart,
        mode: s.mode,
        tableNumber: s.tableNumber,
        customer: s.customer,
        lastOrder: s.lastOrder,
        activeOrder: s.activeOrder,
        customerThemeMode: s.customerThemeMode,
        savedAddresses: s.savedAddresses,
        orderHistory: s.orderHistory,
        productOrderCounts: s.productOrderCounts,
      }),
    },
  ),
);
