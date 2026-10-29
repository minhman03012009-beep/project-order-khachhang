"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import type { PublicSettings } from "@/lib/types";
import { buildVietQrUrl, cn, formatVND, transferMemo } from "@/lib/utils";

/** VietQR image (amount + memo pre-filled) with bank details and copy buttons. */
export function VietQrCard({
  settings,
  amount,
  orderCode,
}: {
  settings: Pick<PublicSettings, "bank_id" | "bank_account_no" | "bank_account_name">;
  amount: number;
  orderCode: string | null;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const url = orderCode ? buildVietQrUrl(settings, amount, orderCode) : null;

  if (!settings.bank_id || !settings.bank_account_no) {
    return (
      <p className="rounded-2xl border border-warn/30 bg-warn/10 p-3 text-[13px] text-warn">
        Quán chưa cấu hình tài khoản ngân hàng. Vui lòng chọn tiền mặt hoặc hỏi nhân viên.
      </p>
    );
  }

  return (
    <div className="animate-rise overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="grid gap-4 p-3 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl bg-white p-2 sm:max-w-none">
          {url && (
            /* eslint-disable-next-line @next/next/no-img-element -- dynamic 3rd-party QR, no optimization wanted */
            <img
              src={url}
              alt={`Mã VietQR thanh toán ${formatVND(amount)}`}
              onLoad={() => setLoadedSrc(url)}
              className={cn(
                "size-full object-contain transition-opacity duration-300",
                loadedSrc === url ? "opacity-100" : "opacity-0",
              )}
            />
          )}
          {loadedSrc !== url && <div className="absolute inset-2 animate-pulse rounded-xl bg-black/10" />}
        </div>
        <dl className="space-y-2 text-[13px]">
          <Row label="Ngân hàng" value={settings.bank_id} />
          <Row label="Số tài khoản" value={settings.bank_account_no} copy />
          {settings.bank_account_name && <Row label="Chủ tài khoản" value={settings.bank_account_name} />}
          <Row label="Số tiền" value={formatVND(amount)} strong copyValue={String(Math.round(amount))} copy />
          {orderCode && <Row label="Nội dung" value={transferMemo(orderCode)} copy />}
        </dl>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download
          className="flex items-center justify-center gap-2 border-t border-white/10 py-2.5 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          <Download className="size-3.5" /> Mở / lưu ảnh QR để quét bằng app ngân hàng
        </a>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  copy,
  copyValue,
}: {
  label: string;
  value: string;
  strong?: boolean;
  copy?: boolean;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/45">{label}</dt>
      <dd className={cn("flex min-w-0 items-center gap-1.5 text-right", strong && "text-base font-bold")}>
        <span className="truncate tabular-nums">{value}</span>
        {copy && (
          <button
            type="button"
            aria-label={`Sao chép ${label}`}
            onClick={() => {
              void navigator.clipboard?.writeText(copyValue ?? value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </dd>
    </div>
  );
}
