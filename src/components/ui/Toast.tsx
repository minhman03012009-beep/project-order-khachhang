"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: number;
  message: string;
  tone: "ok" | "error";
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, tone?: ToastItem["tone"]) => void;
}

let seq = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "ok") => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },
}));

export const toast = (message: string, tone?: ToastItem["tone"]) =>
  useToast.getState().push(message, tone);

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "glass-strong animate-rise flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl shadow-black/50",
          )}
        >
          {t.tone === "ok" ? (
            <CircleCheck className="size-4.5 shrink-0 text-ok" />
          ) : (
            <CircleAlert className="size-4.5 shrink-0 text-danger" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
