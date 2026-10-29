import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Quản trị Quán — Tiệm Mì Indomie",
  description: "Trang quản lý đơn hàng trực tiếp, món chính, topping, VietQR và Telegram Bot.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}

