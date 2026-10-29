import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tiệm Mì Indomie — Đặt mì trộn tại bàn & giao tận nơi",
  description:
    "Quét QR tại bàn hoặc đặt giao tận nơi Mì Trộn Indomie chỉ trong 30 giây. Chọn topping, thanh toán tiền mặt hoặc VietQR, theo dõi đơn theo thời gian thực.",
  applicationName: "Tiệm Mì Indomie",
  openGraph: {
    title: "Tiệm Mì Indomie — Đặt mì siêu tốc",
    description: "Mì Trộn Indomie đủ vị, topping thả ga. Đặt tại bàn hoặc giao tận nơi.",
    images: ["/images/mi_dac_biet.jpg"],
    locale: "vi_VN",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
