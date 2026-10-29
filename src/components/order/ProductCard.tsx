"use client";

import { Plus } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { Product } from "@/lib/types";
import { cn, formatVND } from "@/lib/utils";

export function ProductCard({
  product,
  index,
  onSelect,
  disabled,
  inCartQty = 0,
}: {
  product: Product;
  index: number;
  onSelect: (p: Product) => void;
  disabled?: boolean;
  inCartQty?: number;
}) {
  const soldOut = !product.is_available;
  const blocked = soldOut || disabled;
  return (
    <article
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "card group animate-rise relative flex flex-col overflow-hidden transition duration-300",
        !blocked && "hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]",
        soldOut && "opacity-55",
      )}
    >
      <button
        type="button"
        id={`product-${product.id}`}
        disabled={blocked}
        onClick={() => onSelect(product)}
        aria-label={`Chọn ${product.name}`}
        className="absolute inset-0 z-10 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="relative aspect-square overflow-hidden rounded-[1.4rem] m-1.5 mb-0 sm:aspect-[4/3]">
        <SmartImage
          src={product.image_url}
          alt={product.name}
          sizes="(max-width: 640px) 50vw, 360px"
          priority={index < 2}
          className={cn(
            "transition duration-700 ease-out",
            !blocked && "group-hover:scale-105",
            soldOut && "grayscale",
          )}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        {soldOut && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md">
            Tạm hết
          </span>
        )}
        {!soldOut && inCartQty > 0 && (
          <span
            key={inCartQty}
            className="animate-pop absolute top-2.5 right-2.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-black shadow-lg"
          >
            {inCartQty} trong giỏ
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5 pt-3 sm:p-4">
        <h3 className="line-clamp-2 text-[14px] leading-snug font-semibold sm:text-base">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/50 sm:text-[13px]">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-[15px] font-bold tabular-nums sm:text-base">
            {formatVND(product.price)}
          </span>
          <span
            aria-hidden
            className={cn(
              "grid size-9 place-items-center rounded-xl transition duration-300",
              blocked
                ? "bg-white/10 text-white/40"
                : "bg-white text-black group-hover:rotate-90 group-active:scale-90",
            )}
          >
            <Plus className="size-4.5" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden p-1.5">
      <div className="skeleton aspect-square rounded-[1.4rem] sm:aspect-[4/3]" />
      <div className="space-y-2 p-2.5">
        <div className="skeleton h-4 w-4/5 rounded-md" />
        <div className="skeleton h-3 w-full rounded-md" />
        <div className="flex items-center justify-between pt-2">
          <div className="skeleton h-4 w-16 rounded-md" />
          <div className="skeleton size-9 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
