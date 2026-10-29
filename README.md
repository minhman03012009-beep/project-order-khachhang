# 🍜 Indomie QR & Remote Ordering Web App (Zero-Lag Edition)

Ứng dụng web đặt món **Mì Trộn Indomie** tại bàn qua mã QR và đặt giao hàng tận nơi (Delivery) với kiến trúc **Zero-Lag Single-Page Flow**, phong cách thiết kế **Minimalist Dark Mode + Glassmorphism**.

---

## ✨ Tính năng nổi bật

### 1. Luồng Khách Hàng (`/` — Single-Page Zero-Lag)
- **Chuyển chế độ 1 chạm:** `[🏪 Tại bàn / Mang đi]` và `[🛵 Giao tận nơi]`. Tự động nhận diện bàn khi quét mã QR có dạng `/?table=3`.
- **1-Click Reorder (Đặt lại đơn cũ):** Tự động gợi ý đặt lại thực đơn lần trước từ `localStorage`.
- **Chọn Topping & Ghi chú siêu tốc:** Bottom Sheet trượt mượt mà với bộ đếm số lượng từng loại Topping/Vắt mì, Quick-Tag Pills (`Không hành`, `Ít cay`, `Thêm cay`, `Để sốt riêng`, `Trứng chín kỹ`, `Trứng lòng đào`) và ghi chú riêng cho từng hộp.
- **Tài khoản Tàng hình (Invisible Account):** Định danh qua SĐT 10 số, tự động chào mừng khách quen (`Đơn thứ N của bạn`) và gợi ý dùng lại địa chỉ giao hàng đã che bảo mật.
- **Định vị GPS Zero-Map SDK:** Lấy tọa độ GPS qua `navigator.geolocation`, tính khoảng cách đường chim bay bằng công thức toán học **Haversine**, tự động tính phí ship, kiểm tra bán kính giao hàng tối đa và gợi ý tên đường qua OpenStreetMap Nominatim.
- **Thanh toán Tiền mặt & VietQR tự động:** Tự động sinh mã QR ngân hàng điền sẵn **đúng số tiền** và **nội dung chuyển khoản (`INDOMIE IND042`)**.
- **Hóa đơn & Theo dõi trạng thái đơn trực tiếp:** Cập nhật tiến độ đơn hàng (`Chờ xác nhận` → `Đang nấu` → `Đang giao` → `Hoàn tất`) mỗi 4 giây theo thời gian thực.

### 2. Trang Quản Trị Chủ Quán (`/admin`)
- **Bảo vệ bằng mã PIN** (Mặc định: `123456`, hỗ trợ bàn phím số cảm ứng & phiên đăng nhập `httpOnly` cookie an toàn).
- **Tab 1 — Đơn hàng trực tiếp & Trạng thái quán:**
  - Công tắc lớn **Mở cửa / Tạm đóng cửa**.
  - Thống kê nhanh: Đơn đang xử lý, Tổng đơn hôm nay, Doanh thu hôm nay.
  - **Chuông báo bếp tự động (Web Audio API):** Tự động phát âm báo "Tinh-Tinh" khi có đơn mới mà không cần tải lại trang.
  - Đổi trạng thái đơn 1 chạm (`Đang nấu`, `Đang giao`, `Hoàn tất`, `Hủy`) + **In phiếu bếp / Hóa đơn nhiệt 58mm/80mm**.
- **Tab 2 & Tab 3 — Quản lý Món Chính & Topping (CRUD):**
  - Thêm/Sửa/Xóa món chính và topping, đổi giá tiền, thứ tự hiển thị, gạt công tắc `Còn hàng / Tạm hết` tức thì.
  - Hỗ trợ cả **dán URL ảnh** lẫn **chọn ảnh trực tiếp từ điện thoại/máy tính** (tự động nén & resize qua `<canvas>`).
- **Tab 4 — Cấu hình Quán, VietQR, Telegram Bot & Tạo QR Bàn:**
  - Cập nhật tọa độ GPS của quán bằng 1 nút bấm, chỉnh bán kính giao hàng & phí ship/km.
  - Cấu hình ngân hàng VietQR kèm khung xem trước mã QR trực tiếp.
  - Cấu hình `Telegram Bot Token` & `Chat ID` kèm nút **Gửi tin nhắn Test về điện thoại**.
  - **Công cụ tạo nhãn QR cho từng bàn:** Tải ngay file ảnh nhãn `.PNG` sắc nét (có tên quán, số bàn, mã QR) để in dán lên bàn.

---

## 🚀 Hướng dẫn chạy dự án

### 1. Chạy ngay ở chế độ Hybrid Local (Không cần cấu hình Database)
Dự án đi kèm sẵn **Seed Data** (4 món Mì Trộn Indomie + 8 loại Topping kèm hình ảnh) và cơ chế lưu trữ `.data/db.json` tự động:

```bash
npm install
npm run dev
```

- Trang đặt món của khách: [http://localhost:3000](http://localhost:3000)
- Trang thử quét QR Bàn số 3: [http://localhost:3000/?table=3](http://localhost:3000/?table=3)
- Trang quản trị chủ quán: [http://localhost:3000/admin](http://localhost:3000/admin) (Mã PIN mặc định: `123456`)

### 2. Kết nối Supabase Database (Tùy chọn khi deploy Production)
1. Mở **Supabase Dashboard → SQL Editor** và chạy toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql).
2. Tạo file `.env.local` tại thư mục gốc dự án:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Tùy chọn (khuyên dùng trên server):
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_SESSION_SECRET=your-random-secret-string
```

Hệ thống sẽ tự động chuyển từ `Local Hybrid DB` sang `Supabase DB` mà không cần sửa bất kỳ dòng code nào.
