"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { SmartImage } from "@/components/ui/SmartImage";
import type { CartItem } from "@/lib/store";
import type { Product, Topping } from "@/lib/types";
import { cn, formatVND, ITEM_QUICK_TAGS } from "@/lib/utils";

interface ProductSheetProps {
  open: boolean;
  /** Incremented by the parent on every open → fresh form state. */
  sessionKey: number;
  product: Product | null;
  toppings: Topping[];
  onClose: () => void;
  onAdd: (item: Omit<CartItem, "lineId">) => void;
  disabled?: boolean;
}

/** Bottom sheet (mobile) / modal (desktop) to pick quantity, toppings and per-box notes. */
export function ProductSheet({
  open,
  sessionKey,
  product,
  toppings,
  onClose,
  onAdd,
  disabled,
}: ProductSheetProps) {
  // `product` stays set while the sheet animates out, so content doesn't vanish mid-transition.
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
        />
      )}
    </BottomSheet>
  );
}

function Hero({ product }: { product: Product }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden md:aspect-[16/8]">
      <SmartImage src={product.image_url} alt={product.name} sizes="(max-width: 768px) 100vw, 512px" priority />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/20 to-transparent" />
    </div>
  );
}

function ProductForm({
  product,
  toppings,
  onAdd,
  disabled,
}: {
  product: Product;
  toppings: Topping[];
  onAdd: ProductSheetProps["onAdd"];
  disabled?: boolean;
}) {
  const [qty, setQty] = useState(1);
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
      toppings: available
        .filter((t) => (tops[t.id] ?? 0) > 0)
        .map((t) => ({ id: t.id, name: t.name, price: t.price, quantity: tops[t.id] })),
      quickTags: tags,
      itemNote: note.trim(),
    });
  };

  return (
    <div className="-mt-10 relative">
      {/* Main product */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight font-bold tracking-tight">{product.name}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{product.description}</p>
          <p className="mt-2 text-lg font-bold tabular-nums">{formatVND(product.price)}</p>
        </div>
        <QtyStepper value={qty} onChange={setQty} min={1} max={50} label="số hộp" />
      </div>

      {/* Toppings */}
      {available.length > 0 && (
        <section className="mt-6">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold">Thêm vắt mì &amp; topping</h3>
            <span className="text-xs text-white/45">
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
                    q > 0 ? "border-white/30 bg-white/[0.08]" : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <div className="relative size-13 shrink-0 overflow-hidden rounded-xl">
                    <SmartImage src={t.image_url} alt={t.name} sizes="52px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-[13px] text-white/55 tabular-nums">+{formatVND(t.price)}</p>
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
        <h3 className="mb-2.5 text-[15px] font-semibold">Ghi chú cho hộp mì này</h3>
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
          placeholder="Dặn riêng cho hộp này (VD: nhiều hành phi)…"
          className="field mt-3"
        />
      </section>

      {/* Sticky CTA (inside scroll area bottom) */}
      <div className="sticky bottom-0 -mx-5 mt-6 -mb-6 border-t border-white/10 bg-ink-950/85 px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:-mx-6 md:px-6">
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
