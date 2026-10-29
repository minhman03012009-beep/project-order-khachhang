import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  Customer,
  Order,
  OrderStatus,
  Product,
  StoreSettings,
  Topping,
} from "../types";
import {
  bySortOrder,
  formatOrderCode,
  parseOrderSeq,
  type NewOrder,
  type Repository,
} from "./repository";
import { SEED_PRODUCTS, SEED_SETTINGS, SEED_TOPPINGS } from "./seed";

interface DbShape {
  settings: StoreSettings;
  products: Product[];
  toppings: Topping[];
  customers: Record<string, Customer>;
  orders: Order[];
}

const MAX_ORDERS_KEPT = 2000;

function seedDb(): DbShape {
  return {
    settings: { ...SEED_SETTINGS },
    products: SEED_PRODUCTS.map((p) => ({ ...p })),
    toppings: SEED_TOPPINGS.map((t) => ({ ...t })),
    customers: {},
    orders: [],
  };
}

/**
 * Candidate file locations. The project-local `.data/` folder is preferred;
 * on read-only hosts (e.g. Vercel) we fall back to the OS temp dir, and if
 * even that fails we keep everything in memory.
 */
const CANDIDATE_FILES = [
  path.join(process.cwd(), ".data", "db.json"),
  path.join(os.tmpdir(), "indomie-order", "db.json"),
];

interface LocalState {
  db: DbShape | null;
  file: string | null;
  loading: Promise<DbShape> | null;
  queue: Promise<unknown>;
}

// Survive Next.js dev HMR reloads.
const g = globalThis as unknown as { __indomieLocal?: LocalState };
const state: LocalState = (g.__indomieLocal ??= {
  db: null,
  file: null,
  loading: null,
  queue: Promise.resolve(),
});

async function tryRead(file: string): Promise<DbShape | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    const seed = seedDb();
    return {
      settings: { ...seed.settings, ...(parsed.settings ?? {}) },
      products: parsed.products ?? seed.products,
      toppings: parsed.toppings ?? seed.toppings,
      customers: parsed.customers ?? {},
      orders: parsed.orders ?? [],
    };
  } catch {
    return null;
  }
}

async function tryWrite(file: string, db: DbShape): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, file);
    return true;
  } catch {
    return false;
  }
}

async function load(): Promise<DbShape> {
  if (state.db) return state.db;
  if (!state.loading) {
    state.loading = (async () => {
      for (const file of CANDIDATE_FILES) {
        const db = await tryRead(file);
        if (db) {
          state.file = file;
          state.db = db;
          return db;
        }
      }
      const db = seedDb();
      state.db = db;
      await persist(db);
      return db;
    })();
  }
  return state.loading;
}

async function persist(db: DbShape): Promise<void> {
  const files = state.file
    ? [state.file, ...CANDIDATE_FILES.filter((f) => f !== state.file)]
    : CANDIDATE_FILES;
  for (const file of files) {
    if (await tryWrite(file, db)) {
      state.file = file;
      return;
    }
  }
  state.file = null; // memory-only mode
}

/** Serialize all mutations so concurrent requests never clobber each other. */
function mutate<T>(fn: (db: DbShape) => T | Promise<T>): Promise<T> {
  const run = state.queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await persist(db);
    return result;
  });
  state.queue = run.catch(() => undefined);
  return run;
}

const clone = <T>(v: T): T => structuredClone(v);

export class LocalRepository implements Repository {
  readonly kind = "local" as const;

  async getSettings() {
    return clone((await load()).settings);
  }

  updateSettings(patch: Partial<StoreSettings>) {
    return mutate((db) => {
      db.settings = { ...db.settings, ...patch, id: db.settings.id };
      return clone(db.settings);
    });
  }

  async listProducts() {
    return clone([...(await load()).products].sort(bySortOrder));
  }

  upsertProduct(product: Product) {
    return mutate((db) => {
      const idx = db.products.findIndex((p) => p.id === product.id);
      if (idx >= 0) db.products[idx] = product;
      else db.products.push(product);
      return clone(product);
    });
  }

  deleteProduct(id: string) {
    return mutate((db) => {
      db.products = db.products.filter((p) => p.id !== id);
    });
  }

  async listToppings() {
    return clone([...(await load()).toppings].sort(bySortOrder));
  }

  upsertTopping(topping: Topping) {
    return mutate((db) => {
      const idx = db.toppings.findIndex((t) => t.id === topping.id);
      if (idx >= 0) db.toppings[idx] = topping;
      else db.toppings.push(topping);
      return clone(topping);
    });
  }

  deleteTopping(id: string) {
    return mutate((db) => {
      db.toppings = db.toppings.filter((t) => t.id !== id);
    });
  }

  async getCustomer(phone: string) {
    const c = (await load()).customers[phone];
    return c ? clone(c) : null;
  }

  upsertCustomer(customer: Customer) {
    return mutate((db) => {
      db.customers[customer.phone] = customer;
      return clone(customer);
    });
  }

  async listOrders(limit = 100) {
    const db = await load();
    return clone(
      [...db.orders]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit),
    );
  }

  async getOrder(id: string) {
    const o = (await load()).orders.find((x) => x.id === id);
    return o ? clone(o) : null;
  }

  async nextOrderCode() {
    const db = await load();
    const maxSeq = db.orders.reduce(
      (m, o) => Math.max(m, parseOrderSeq(o.order_code)),
      0,
    );
    return formatOrderCode(maxSeq + 1);
  }

  async isOrderCodeTaken(code: string) {
    return (await load()).orders.some((o) => o.order_code === code);
  }

  createOrder(input: NewOrder) {
    return mutate((db) => {
      const maxSeq = db.orders.reduce(
        (m, o) => Math.max(m, parseOrderSeq(o.order_code)),
        0,
      );
      const code =
        input.order_code &&
        !db.orders.some((o) => o.order_code === input.order_code)
          ? input.order_code
          : formatOrderCode(maxSeq + 1);
      const order: Order = {
        ...input,
        id: randomUUID(),
        order_code: code,
        created_at: new Date().toISOString(),
      };
      db.orders.push(order);
      if (db.orders.length > MAX_ORDERS_KEPT) {
        db.orders = db.orders.slice(-MAX_ORDERS_KEPT);
      }
      return clone(order);
    });
  }

  updateOrderStatus(id: string, status: OrderStatus) {
    return mutate((db) => {
      const o = db.orders.find((x) => x.id === id);
      if (!o) return null;
      o.status = status;
      return clone(o);
    });
  }
}
