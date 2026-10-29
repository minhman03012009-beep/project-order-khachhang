"use client";

import {
  ImagePlus,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fileToCompressedDataUrl } from "@/components/admin/image-utils";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Toggle } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { toast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import type { Product, Topping } from "@/lib/types";
import { cn, formatVND } from "@/lib/utils";

type Kind = "products" | "toppings";

interface ItemDraft {
  id?: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  sort_order: number;
}

const QUICK_PRICES: Record<Kind, number[]> = {
  products: [25000, 30000, 32000, 35000, 39000, 45000],
  toppings: [5000, 6000, 8000, 10000, 12000, 15000],
};

export function MenuCrudTab({ kind }: { kind: Kind }) {
  const isProduct = kind === "products";
  const [items, setItems] = useState<(Product | Topping)[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadItems = useCallback(async () => {
    try {
      if (isProduct) {
        const res = await api<{ products: Product[] }>("/api/admin/products");
        setItems(res.products);
      } else {
        const res = await api<{ toppings: Topping[] }>("/api/admin/toppings");
        setItems(res.toppings);
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }, [isProduct]);

  useEffect(() => {
    let active = true;
    const req = isProduct
      ? api<{ products: Product[] }>("/api/admin/products").then((r) => r.products)
      : api<{ toppings: Topping[] }>("/api/admin/toppings").then((r) => r.toppings);
    req
      .then((list) => {
        if (active) setItems(list);
      })
      .catch((e) => {
        if (active) toast(errorMessage(e), "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isProduct]);

  const openCreate = () => {
    setDraft({
      name: "",
      description: "",
      price: isProduct ? 25000 : 10000,
      image_url: "",
      is_available: true,
      sort_order: items.length + 1,
    });
  };

  const openEdit = (item: Product | Topping) => {
    setDraft({
      id: item.id,
      name: item.name,
      description: "description" in item ? item.description : "",
      price: item.price,
      image_url: item.image_url,
      is_available: item.is_available,
      sort_order: item.sort_order,
    });
  };

  const handleToggleAvailable = async (item: Product | Topping, nextVal: boolean) => {
    // Optimistic update
    setItems((cur) =>
      cur.map((x) => (x.id === item.id ? { ...x, is_available: nextVal } : x)),
    );
    try {
      if (isProduct) {
        const res = await api<{ product: Product }>(`/api/admin/products/${item.id}`, {
          method: "PUT",
          json: { is_available: nextVal },
        });
        setItems((cur) => cur.map((x) => (x.id === item.id ? res.product : x)));
      } else {
        const res = await api<{ topping: Topping }>(`/api/admin/toppings/${item.id}`, {
          method: "PUT",
          json: { is_available: nextVal },
        });
        setItems((cur) => cur.map((x) => (x.id === item.id ? res.topping : x)));
      }
      toast(
        `${item.name}: ${nextVal ? "🟢 Đã bật Còn hàng" : "🔴 Đã báo Tạm hết"}`,
      );
    } catch (e) {
      toast(errorMessage(e), "error");
      void loadItems();
    }
  };

  const handleDelete = async (item: Product | Topping) => {
    if (!window.confirm(`Bạn chắc chắn muốn xóa "${item.name}"?`)) return;
    try {
      await api(`/api/admin/${kind}/${item.id}`, { method: "DELETE" });
      setItems((cur) => cur.filter((x) => x.id !== item.id));
      if (draft?.id === item.id) setDraft(null);
      toast(`Đã xóa "${item.name}"`);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !draft) return;
    setUploadingImg(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, isProduct ? 720 : 400, 0.82);
      setDraft((cur) => (cur ? { ...cur, image_url: dataUrl } : cur));
      toast("✨ Đã nén & tải ảnh lên thành công!");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast("Vui lòng nhập tên.", "error");
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(draft.id);
      const url = isEdit ? `/api/admin/${kind}/${draft.id}` : `/api/admin/${kind}`;
      const method = isEdit ? "PUT" : "POST";

      if (isProduct) {
        const res = await api<{ product: Product }>(url, {
          method,
          json: draft,
        });
        setItems((cur) => {
          const next = isEdit
            ? cur.map((x) => (x.id === res.product.id ? res.product : x))
            : [...cur, res.product];
          return [...next].sort((a, b) => a.sort_order - b.sort_order);
        });
      } else {
        const res = await api<{ topping: Topping }>(url, {
          method,
          json: draft,
        });
        setItems((cur) => {
          const next = isEdit
            ? cur.map((x) => (x.id === res.topping.id ? res.topping : x))
            : [...cur, res.topping];
          return [...next].sort((a, b) => a.sort_order - b.sort_order);
        });
      }
      toast(isEdit ? "Đã lưu thay đổi!" : "Đã thêm mới thành công!");
      setDraft(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-bold sm:text-lg">
            {isProduct
              ? `🍜 Danh sách Món Chính (${items.length})`
              : `🥚 Danh sách Topping & Vắt mì (${items.length})`}
          </h2>
          <p className="mt-0.5 text-xs text-white/55">
            {isProduct
              ? "Thêm món mới, đổi giá, đổi ảnh sản phẩm hoặc gạt tắt những món vừa hết."
              : "Thêm topping mới, tùy chỉnh giá cộng thêm, hình ảnh và trạng thái Còn/Hết."}
          </p>
        </div>
        <button
          id={`add-${kind}-btn`}
          type="button"
          onClick={openCreate}
          className="btn-primary text-xs sm:text-sm"
        >
          <Plus className="size-4" />
          {isProduct ? "Thêm món mới" : "Thêm Topping mới"}
        </button>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-28 skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-sm font-semibold">Chưa có mục nào</p>
          <button type="button" onClick={openCreate} className="btn-primary mt-4 text-xs">
            <Plus className="size-4" /> Tạo mục đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className={cn(
                "card flex items-center gap-3.5 p-3 transition",
                !item.is_available && "opacity-60",
              )}
            >
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10"
              >
                <SmartImage src={item.image_url} alt={item.name} sizes="80px" />
                {!item.is_available && (
                  <span className="absolute inset-0 grid place-items-center bg-black/70 text-[10px] font-bold text-white">
                    TẠM HẾT
                  </span>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-sm font-bold">{item.name}</h3>
                  <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40 tabular-nums">
                    #{item.sort_order}
                  </span>
                </div>

                {"description" in item && item.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-white/50">{item.description}</p>
                )}

                <p className="mt-1 text-sm font-extrabold text-white tabular-nums">
                  {isProduct ? formatVND(item.price) : `+${formatVND(item.price)}`}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={item.is_available}
                      onChange={(v) => void handleToggleAvailable(item, v)}
                      label={`Còn hàng ${item.name}`}
                    />
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        item.is_available ? "text-ok" : "text-white/40",
                      )}
                    >
                      {item.is_available ? "Còn hàng" : "Tạm hết"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      aria-label={`Sửa ${item.name}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 text-white/75 transition hover:bg-white hover:text-black"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      aria-label={`Xóa ${item.name}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 text-white/45 transition hover:border-danger/40 hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit BottomSheet Modal */}
      <BottomSheet
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={
          draft?.id
            ? isProduct
              ? "Chỉnh sửa món chính"
              : "Chỉnh sửa Topping"
            : isProduct
              ? "Thêm món chính mới"
              : "Thêm Topping mới"
        }
        footer={
          draft ? (
            <div className="flex gap-2.5">
              {draft.id && (
                <button
                  type="button"
                  onClick={() => {
                    const found = items.find((x) => x.id === draft.id);
                    if (found) void handleDelete(found);
                  }}
                  className="btn-danger px-4 py-3.5"
                >
                  <Trash2 className="size-4" /> Xóa
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="btn-primary flex-1 py-3.5"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {saving ? "Đang lưu…" : "Lưu thông tin"}
              </button>
            </div>
          ) : null
        }
      >
        {draft && (
          <div className="space-y-4">
            {/* Image preview + Upload / URL controls */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
              <div className="relative mx-auto size-24 shrink-0 overflow-hidden rounded-2xl border border-white/15 sm:mx-0">
                <SmartImage src={draft.image_url} alt={draft.name || "Preview"} sizes="96px" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFilePicked}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingImg}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary px-3 py-2 text-xs"
                  >
                    {uploadingImg ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="size-3.5" />
                    )}
                    Chọn ảnh từ máy / điện thoại
                  </button>
                  {draft.image_url && (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, image_url: "" })}
                      className="btn-ghost px-3 py-2 text-xs text-white/60"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Link2 className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-white/35" />
                  <input
                    value={draft.image_url.startsWith("data:") ? "" : draft.image_url}
                    onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                    placeholder={
                      draft.image_url.startsWith("data:")
                        ? "Đang dùng ảnh tải lên từ thiết bị (hoặc dán link ảnh vào đây)"
                        : "Hoặc dán link ảnh (https://... hoặc /images/...)"
                    }
                    className="field py-2 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="label">
                {isProduct ? "Tên món mì" : "Tên Topping / Vắt mì"}
              </label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={
                  isProduct
                    ? "VD: Mì Trộn Indomie Đặc Biệt"
                    : "VD: Trứng lòng đào ngâm tương"
                }
                className="field"
              />
            </div>

            {isProduct && (
              <div>
                <label className="label">Mô tả nguyên liệu</label>
                <textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="VD: Full topping trứng lòng đào, xúc xích nướng, chả cá Hàn Quốc…"
                  className="field resize-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Giá tiền (VNĐ)</label>
                <input
                  type="number"
                  step={1000}
                  min={0}
                  value={draft.price}
                  onChange={(e) =>
                    setDraft({ ...draft, price: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="field font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="label">Thứ tự hiển thị</label>
                <input
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) =>
                    setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })
                  }
                  className="field tabular-nums"
                />
              </div>
            </div>

            {/* Quick Price Suggestions */}
            <div>
              <span className="text-[11px] text-white/45">Chọn nhanh mức giá:</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {QUICK_PRICES[kind].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDraft({ ...draft, price: p })}
                    className={cn(
                      "cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-semibold tabular-nums transition",
                      draft.price === p
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/5 text-white/65 hover:border-white/30",
                    )}
                  >
                    {formatVND(p)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Trạng thái phục vụ</p>
                <p className="text-xs text-white/50">
                  {draft.is_available ? "Đang mở bán trên menu" : "Đang báo tạm hết"}
                </p>
              </div>
              <Toggle
                checked={draft.is_available}
                onChange={(v) => setDraft({ ...draft, is_available: v })}
                label="Còn hàng"
              />
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

