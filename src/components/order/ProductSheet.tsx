"use client";

import { Flame, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { SmartImage } from "@/components/ui/SmartImage";
import type { CartItem } from "@/lib/store";
import type { Product, Topping } from "@/lib/types";
import { cn, formatVND, ITEM_QUICK_TAGS, SPICY_OPTIONS } from "@/lib/utils";

interface ProductSheetProps {
  open: boolean;
  /** Incremented by the parent on every open → fresh form state. */
  sessionKey: number;
  product: Product | null;
  toppings: Topping[];
  onClose: () => void;
  onAdd: (item: Omit<CartItem, "lineId">) => void;
  disabled?: boolean;
  enableSpicyLevel?: boolean;
  unitLabel?: string;
}

/** Bottom sheet (mobile) / modal (desktop) to pick quantity, spicy level, toppings and per-box notes. */
export function ProductSheet({
  open,
  sessionKey,
  product,
  toppings,
  onClose,
  onAdd,
  disabled,
  enableSpicyLevel = false,
  unitLabel = "hộp",
}: ProductSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      hero={product ? <Hero product={product} /> : null}
      footer={null}
    >
      {product && (
        <ProductForm
          key={`${product.id}-${sessionKey}`}
          product={product}
          toppings={toppings}
          onAdd={onAdd}
          disabled={disabled}
          enableSpicyLevel={enableSpicyLevel}
          unitLabel={unitLabel}
        />
      )}
    </BottomSheet>
  );
}

function Hero({ product }: { product: Product }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden md:aspect-[16/8]">
      <SmartImage src={product.image_url} alt={product.name} sizes="(max-width: 768px) 100vw, 512px" priority />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-strong via-black/15 to-transparent" />
    </div>
  );
}

function ProductForm({
  product,
  toppings,
  onAdd,
  disabled,
  enableSpicyLevel,
  unitLabel,
}: {
  product: Product;
  toppings: Topping[];
  onAdd: ProductSheetProps["onAdd"];
  disabled?: boolean;
  enableSpicyLevel: boolean;
  unitLabel: string;
}) {
  const [qty, setQty] = useState(1);
  const [spicyLevel, setSpicyLevel] = useState<number>(1);
  const [tops, setTops] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const available = toppings.filter((t) => t.is_available);
  const toppingSum = available.reduce((s, t) => s + t.price * (tops[t.id] ?? 0), 0);
  const unit = product.price + toppingSum;
  const total = unit * qty;
  const toppingCount = Object.values(tops).reduce((a, b) => a + b, 0);

  const toggleTag = (tag: string) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  const submit = () => {
    onAdd({
      productId: product.id,
      productName: product.name,
      image_url: product.image_url,
      basePrice: product.price,
      quantity: qty,
      spicyLevel: enableSpicyLevel ? spicyLevel : null,
      toppings: available
        .filter((t) => (tops[t.id] ?? 0) > 0)
        .map((t) => ({ id: t.id, name: t.name, price: t.price, quantity: tops[t.id] })),
      quickTags: tags,
      itemNote: note.trim(),
    });
  };

  return (
    <div className="relative -mt-8">
      {/* Main product */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight font-bold tracking-tight text-fg">{product.name}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{product.description}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-lg font-bold text-fg tabular-nums">{formatVND(product.price)}</p>
            {product.original_price != null && product.original_price > product.price && (
              <p className="text-sm text-subtle line-through tabular-nums">
                {formatVND(product.original_price)}
              </p>
            )}
          </div>
        </div>
        <QtyStepper value={qty} onChange={setQty} min={1} max={50} label={`số ${unitLabel}`} />
      </div>

      {/* Optional Spicy Level Selector (0 - 7) */}
      {enableSpicyLevel && (
        <section className="mt-6">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
              <Flame className="size-4 text-danger" /> Chọn cấp độ cay (0 – 7)
            </h3>
            <span className="text-xs text-muted">
              {SPICY_OPTIONS.find((s) => s.level === spicyLevel)?.desc}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {SPICY_OPTIONS.map((sp) => {
              const active = spicyLevel === sp.level;
              return (
                <button
                  key={sp.level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSpicyLevel(sp.level)}
                  className={cn(
                    "cursor-pointer rounded-2xl border px-2 py-2.5 text-center text-xs font-bold transition active:scale-95",
                    active
                      ? "border-accent bg-accent text-accent-fg shadow-md"
                      : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  {sp.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Toppings */}
      {available.length > 0 && (
        <section className="mt-6">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold text-fg">Thêm vắt mì &amp; topping</h3>
            <span className="text-xs text-subtle">
              {toppingCount > 0 ? `Đã chọn ${toppingCount}` : "Không bắt buộc"}
            </span>
          </div>
          <ul className="space-y-2">
            {available.map((t) => {
              const q = tops[t.id] ?? 0;
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-2 pr-2.5 transition duration-200",
                    q > 0 ? "border-line-strong bg-surface-hover" : "border-line bg-surface",
                  )}
                >
                  <div className="relative size-13 shrink-0 overflow-hidden rounded-xl">
                    <SmartImage src={t.image_url} alt={t.name} sizes="52px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{t.name}</p>
                    <p className="text-[13px] text-muted tabular-nums">+{formatVND(t.price)}</p>
                  </div>
                  <QtyStepper
                    size="sm"
                    collapsible
                    value={q}
                    max={10}
                    label={t.name}
                    onChange={(v) => setTops((cur) => ({ ...cur, [t.id]: v }))}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Quick tags */}
      <section className="mt-6">
        <h3 className="mb-2.5 text-[15px] font-semibold text-fg">Ghi chú cho {unitLabel} này</h3>
        <div className="flex flex-wrap gap-2">
          {ITEM_QUICK_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={on ? "pill-on" : "pill-off"}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <input
          id="item-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder={`Dặn riêng cho ${unitLabel} này (VD: nhiều hành phi)…`}
          className="field mt-3"
        />
      </section>

      {/* Sticky CTA (inside scroll area bottom) */}
      <div className="sticky bottom-0 -mx-5 mt-6 -mb-6 border-t border-line bg-surface-strong px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:-mx-6 md:px-6">
        <button
          id="add-to-cart-btn"
          type="button"
          onClick={submit}
          disabled={disabled}
          className="btn-primary w-full py-4 text-[15px]"
        >
          <ShoppingBag className="size-4.5" />
          {disabled ? "Quán đang tạm ngưng nhận đơn" : `Thêm vào giỏ hàng • ${formatVND(total)}`}
        </button>
      </div>
    </div>
  );
}
