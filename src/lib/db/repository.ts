import type {
  Customer,
  Order,
  OrderStatus,
  Product,
  StoreSettings,
  Topping,
} from "../types";

export type NewOrder = Omit<Order, "id" | "created_at" | "order_code"> & {
  order_code?: string;
};

/**
 * Storage-agnostic data access layer.
 * Implemented by LocalRepository (JSON file / memory) and SupabaseRepository.
 */
export interface Repository {
  readonly kind: "local" | "supabase";

  getSettings(): Promise<StoreSettings>;
  updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings>;

  listProducts(): Promise<Product[]>;
  upsertProduct(product: Product): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  listToppings(): Promise<Topping[]>;
  upsertTopping(topping: Topping): Promise<Topping>;
  deleteTopping(id: string): Promise<void>;

  getCustomer(phone: string): Promise<Customer | null>;
  upsertCustomer(customer: Customer): Promise<Customer>;

  listOrders(limit?: number): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  /** Returns the next sequential code, e.g. "#IND-042". */
  nextOrderCode(): Promise<string>;
  isOrderCodeTaken(code: string): Promise<boolean>;
  createOrder(order: NewOrder): Promise<Order>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null>;
}

export function formatOrderCode(seq: number): string {
  return `#IND-${String(seq).padStart(3, "0")}`;
}

export function parseOrderSeq(code: string): number {
  const m = /(\d+)$/.exec(code);
  return m ? Number(m[1]) : 0;
}

export const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) =>
  a.sort_order - b.sort_order;
