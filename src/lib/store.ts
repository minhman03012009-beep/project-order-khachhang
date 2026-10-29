"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OrderTopping, OrderType, PaymentMethod } from "./types";

export interface CartItem {
  lineId: string;
  productId: string;
  productName: string;
  image_url: string;
  basePrice: number;
  quantity: number;
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

export interface ActiveOrder {
  id: string;
  code: string;
  total: number;
  payment_method: PaymentMethod;
  createdAt: string;
}

export const unitPrice = (it: Pick<CartItem, "basePrice" | "toppings">) =>
  it.basePrice + it.toppings.reduce((s, t) => s + t.price * t.quantity, 0);

export const lineTotal = (it: CartItem) => unitPrice(it) * it.quantity;

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Two lines are "the same" if product, toppings and notes match → merge quantity. */
const signature = (it: Omit<CartItem, "lineId" | "quantity">) =>
  JSON.stringify([
    it.productId,
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
      }),
    },
  ),
);
