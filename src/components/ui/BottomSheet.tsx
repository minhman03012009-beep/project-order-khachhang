"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Hero element rendered edge-to-edge above the scroll area (e.g. product image). */
  hero?: ReactNode;
  className?: string;
  size?: "md" | "lg";
}

/**
 * Bottom sheet on mobile, centered modal on ≥ md.
 * Pure CSS keyframe animations → no animation library, no layout thrash.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  hero,
  className,
  size = "md",
}: BottomSheetProps) {
  const titleId = useId();
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // Derive mount/unmount transitions during render (no effect → no extra paint).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!rendered) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [rendered, onClose]);

  if (!rendered) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/70 backdrop-blur-sm",
          closing ? "animate-fade-out" : "animate-fade-in",
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && closing) {
            setRendered(false);
            setClosing(false);
          }
        }}
        className={cn(
          "glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] shadow-2xl shadow-black md:rounded-[2rem]",
          size === "lg" ? "md:max-w-2xl" : "md:max-w-lg",
          closing ? "animate-sheet-down md:animate-modal-out" : "animate-sheet-up md:animate-modal-in",
          className,
        )}
      >
        {/* drag handle (mobile affordance) */}
        <div className="pointer-events-none absolute top-2 left-1/2 z-20 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/25 md:hidden" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-3 right-3 z-20 grid size-9 cursor-pointer place-items-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-md transition hover:bg-black/70 hover:text-white active:scale-90"
        >
          <X className="size-4.5" />
        </button>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {hero}
          {title && (
            <div className="px-5 pt-6 pb-2 md:px-6">
              <h2 id={titleId} className="pr-10 text-xl font-bold tracking-tight">
                {title}
              </h2>
            </div>
          )}
          <div className="px-5 pb-6 md:px-6">{children}</div>
        </div>

        {footer && (
          <div className="border-t border-white/10 bg-ink-950/80 px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
