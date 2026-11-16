import type { PublicSettings, StoreSettings, ThemeMode } from "./types";

export interface ThemePreset {
  id: string;
  name: string;
  desc: string;
  mode: ThemeMode;
  bgColor: string;
  accentColor: string;
  previewCard: string;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "obsidian",
    name: "Obsidian Minimalist",
    desc: "Đen tuyền sang trọng • Nút trắng tối giản",
    mode: "dark",
    bgColor: "#050505",
    accentColor: "#ffffff",
    previewCard: "#141416",
  },
  {
    id: "midnight_izakaya",
    name: "Đêm Izakaya",
    desc: "Xám đêm hiện đại • Điểm nhấn Cam Đỏ",
    mode: "dark",
    bgColor: "#14161B",
    accentColor: "#F95700",
    previewCard: "#1E2128",
  },
  {
    id: "cream_vermilion",
    name: "Kem Sáng Tinh Hoa",
    desc: "Nền kem ấm áp • Điểm nhấn Đỏ Son",
    mode: "light",
    bgColor: "#FFFDF9",
    accentColor: "#E02424",
    previewCard: "#FAF4EB",
  },
  {
    id: "matcha_studio",
    name: "Matcha Studio",
    desc: "Trắng trà xanh • Điểm nhấn Xanh Rêu",
    mode: "light",
    bgColor: "#F6F8F4",
    accentColor: "#1B4332",
    previewCard: "#EBF0E8",
  },
  {
    id: "royal_gold",
    name: "Đen Vàng Gold",
    desc: "Đen nhám • Điểm nhấn Vàng Hổ Phách",
    mode: "dark",
    bgColor: "#0A0908",
    accentColor: "#F59E0B",
    previewCard: "#181512",
  },
  {
    id: "ocean_slate",
    name: "Xanh Slate",
    desc: "Xanh đêm sâu • Điểm nhấn Xanh Cyan",
    mode: "dark",
    bgColor: "#0B1120",
    accentColor: "#38BDF8",
    previewCard: "#131C31",
  },
];

export interface IndustryTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  patch: Partial<StoreSettings>;
}

export const INDUSTRY_TEMPLATES: readonly IndustryTemplate[] = [
  {
    id: "indomie",
    name: "Tiệm Mì Trộn Indomie",
    icon: "🍜",
    desc: "Mặc định tối giản đen trắng, đơn vị hộp, tối ưu tốc độ.",
    patch: {
      store_name: "Tiệm Mì Indomie",
      menu_title: "Thực đơn Mì Trộn",
      item_unit_label: "hộp",
      theme_preset: "obsidian",
      theme_mode: "dark",
      theme_bg_color: "#050505",
      theme_accent_color: "#ffffff",
      enable_spicy_level: false,
      enable_cutlery_option: true,
    },
  },
  {
    id: "micay",
    name: "Quán Mì Cay Hàn Quốc 7 Cấp",
    icon: "🌶️",
    desc: "Bật chọn cấp cay 0–7, giao diện Kem Sáng / Đêm Izakaya, Freeship 150k.",
    patch: {
      store_name: "Mì Cay Tinh Hoa",
      menu_title: "Thực đơn Mì Cay",
      item_unit_label: "tô",
      theme_preset: "cream_vermilion",
      theme_mode: "light",
      theme_bg_color: "#FFFDF9",
      theme_accent_color: "#E02424",
      enable_spicy_level: true,
      enable_cutlery_option: true,
      freeship_threshold: 150000,
      self_pickup_discount_pct: 10,
      force_vietqr_high_risk: true,
    },
  },
  {
    id: "milktea",
    name: "Trà Sữa & Ăn Vặt",
    icon: "🧋",
    desc: "Tone Matcha Studio thanh lịch, đơn vị ly, tự chọn topping trân châu.",
    patch: {
      store_name: "Tiệm Trà & Bánh",
      menu_title: "Menu Đồ Uống",
      item_unit_label: "ly",
      theme_preset: "matcha_studio",
      theme_mode: "light",
      theme_bg_color: "#F6F8F4",
      theme_accent_color: "#1B4332",
      enable_spicy_level: false,
      enable_cutlery_option: false,
      freeship_threshold: 100000,
    },
  },
  {
    id: "rice_noodle",
    name: "Cơm Tấm / Bún Đậu / Quán Ăn",
    icon: "🍱",
    desc: "Tone Đen Vàng sang trọng, đơn vị phần, đặt tại bàn & giao tận nơi.",
    patch: {
      store_name: "Bếp Nhà Ngon",
      menu_title: "Thực đơn Hôm Nay",
      item_unit_label: "phần",
      theme_preset: "royal_gold",
      theme_mode: "dark",
      theme_bg_color: "#0A0908",
      theme_accent_color: "#F59E0B",
      enable_spicy_level: false,
      enable_cutlery_option: true,
      freeship_threshold: 150000,
    },
  },
];

export function isValidHexColor(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex.trim());
}

export function normalizeHex(hex: string, fallback: string): string {
  const clean = (hex || "").trim();
  return isValidHexColor(clean) ? clean : fallback;
}

/** Computes WCAG relative luminance and returns contrasting foreground hex. */
export function getContrastTextColor(hex: string): "#050505" | "#ffffff" {
  const clean = normalizeHex(hex, "#050505").slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.44 ? "#050505" : "#ffffff";
}

function hexToRgbTuple(hex: string): string {
  const clean = normalizeHex(hex, "#ffffff").slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function resolveEffectiveTheme(
  settings: Pick<
    PublicSettings,
    "theme_mode" | "theme_bg_color" | "theme_accent_color" | "allow_customer_theme_toggle"
  > | null,
  customerOverride: "auto" | ThemeMode = "auto",
): { mode: ThemeMode; bgColor: string; accentColor: string; accentFg: string } {
  const storeMode: ThemeMode = settings?.theme_mode === "light" ? "light" : "dark";
  const effectiveMode: ThemeMode =
    settings?.allow_customer_theme_toggle && customerOverride !== "auto"
      ? customerOverride
      : storeMode;

  let bgColor = normalizeHex(
    settings?.theme_bg_color || "",
    effectiveMode === "light" ? "#FFFDF9" : "#050505",
  );
  // If customer flipped light/dark mode relative to store default, pick matching clean base bg
  if (effectiveMode !== storeMode) {
    bgColor = effectiveMode === "light" ? "#FFFDF9" : "#0E1014";
  }

  let accentColor = normalizeHex(
    settings?.theme_accent_color || "",
    effectiveMode === "light" ? "#E02424" : "#ffffff",
  );
  // Ensure white accent on light background flips to dark charcoal or brand red so buttons remain visible
  if (effectiveMode === "light" && accentColor.toLowerCase() === "#ffffff") {
    accentColor = "#18181B";
  }
  if (effectiveMode === "dark" && accentColor.toLowerCase() === "#050505") {
    accentColor = "#ffffff";
  }

  return {
    mode: effectiveMode,
    bgColor,
    accentColor,
    accentFg: getContrastTextColor(accentColor),
  };
}

export function applyThemeToDocument(
  settings: Pick<
    PublicSettings,
    "theme_mode" | "theme_bg_color" | "theme_accent_color" | "allow_customer_theme_toggle"
  > | null,
  customerOverride: "auto" | ThemeMode = "auto",
) {
  if (typeof document === "undefined") return;
  const resolved = resolveEffectiveTheme(settings, customerOverride);
  const root = document.documentElement;
  root.dataset.themeMode = resolved.mode;
  root.style.setProperty("--app-bg", resolved.bgColor);
  root.style.setProperty("--app-accent", resolved.accentColor);
  root.style.setProperty("--app-accent-fg", resolved.accentFg);
  root.style.setProperty("--app-accent-rgb", hexToRgbTuple(resolved.accentColor));

  if (resolved.mode === "light") {
    root.style.setProperty("--app-fg", "#1E1B1A");
    root.style.setProperty("--app-muted", "rgb(30 27 26 / 0.62)");
    root.style.setProperty("--app-subtle", "rgb(30 27 26 / 0.42)");
    root.style.setProperty("--app-surface", "rgb(255 255 255 / 0.84)");
    root.style.setProperty("--app-surface-hover", "rgb(255 255 255 / 0.98)");
    root.style.setProperty("--app-surface-strong", "rgb(255 253 249 / 0.94)");
    root.style.setProperty("--app-border", "rgb(30 27 26 / 0.1)");
    root.style.setProperty("--app-border-strong", "rgb(30 27 26 / 0.22)");
    root.style.setProperty("--app-chip", "rgb(30 27 26 / 0.05)");
    root.style.setProperty("--app-shadow", "rgb(30 27 26 / 0.08)");
  } else {
    root.style.setProperty("--app-fg", "#f5f5f5");
    root.style.setProperty("--app-muted", "rgb(245 245 245 / 0.56)");
    root.style.setProperty("--app-subtle", "rgb(245 245 245 / 0.36)");
    root.style.setProperty("--app-surface", "rgb(255 255 255 / 0.05)");
    root.style.setProperty("--app-surface-hover", "rgb(255 255 255 / 0.09)");
    root.style.setProperty("--app-surface-strong", "rgb(11 11 12 / 0.9)");
    root.style.setProperty("--app-border", "rgb(255 255 255 / 0.1)");
    root.style.setProperty("--app-border-strong", "rgb(255 255 255 / 0.25)");
    root.style.setProperty("--app-chip", "rgb(255 255 255 / 0.06)");
    root.style.setProperty("--app-shadow", "rgb(0 0 0 / 0.65)");
  }
}

