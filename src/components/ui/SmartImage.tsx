"use client";

import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}

/**
 * Local images (/images/...) go through next/image optimization (AVIF/WebP, resized).
 * External URLs and base64 uploads are rendered unoptimized so any link the owner pastes just works.
 * Parent must be `relative` with a defined size.
 */
export function SmartImage({ src, alt, sizes, className, priority }: SmartImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "absolute inset-0 grid place-items-center bg-gradient-to-br from-white/10 to-white/[0.02] text-white/30",
          className,
        )}
      >
        <UtensilsCrossed className="size-1/3 max-h-10 max-w-10" />
      </div>
    );
  }
  const local = src.startsWith("/");
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!local}
      className={cn("object-cover", className)}
    />
  );
}
