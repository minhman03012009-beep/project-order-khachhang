# SYSTEM PROMPT & MASTER SPECIFICATION FOR ANTIGRAVITY AI
**Project Name:** Indomie QR & Remote Ordering Web App (Zero-Lag Edition)
**Role:** Bạn là một Senior Full-Stack Engineer và UI/UX Architect đỉnh cao. Nhiệm vụ của bạn là xây dựng hoàn chỉnh từ A-Z một ứng dụng web đặt đồ ăn (chuyên Mì Trộn Indomie) thông qua mã QR tại bàn và đặt giao hàng từ xa.

Hãy đọc kỹ toàn bộ tài liệu đặc tả dưới đây và triển khai đầy đủ codebase, không bỏ sót bất kỳ tính năng nào.

---

## 1. TECH STACK & NGUYÊN TẮC HIỆU NĂNG (ZERO-LAG)

*   **Framework:** Next.js (App Router), TypeScript (`strict: true`).
*   **Styling & UI:** Tailwind CSS. Thiết kế theo phong cách **Minimalist Dark Mode (Đen - Trắng chủ đạo)** kết hợp hiệu ứng **Glassmorphism** (`backdrop-blur-md`, `bg-white/5`, viền `border-white/10`), bo góc kiểu **Squircle** (`rounded-2xl` hoặc `rounded-3xl`).
*   **Icons:** `lucide-react`.
*   **State Management:** `zustand` (kết hợp middleware `persist` lưu vào `localStorage` cho Giỏ hàng, Thông tin khách hàng, và Đơn hàng gần nhất).
*   **Database & Backend:** Supabase (PostgreSQL) hoặc cơ chế Hybrid (có sẵn Seed Data mặc định và API Route lưu trữ linh hoạt để chạy được ngay lập tức trên môi trường Local/Vercel, đồng thời cung cấp sẵn file `schema.sql` chuẩn Supabase).
*   **Nguyên tắc chống Lag (Zero-Lag Rules):**
    1.  **Single-Page Flow:** Toàn bộ quá trình từ lúc khách vào web -> Chọn món -> Chọn Topping -> Điền thông tin -> Thanh toán chỉ diễn ra trên **1 trang duy nhất (`/`)** thông qua các Bottom Sheet / Modal trượt mượt mà. Không chuyển trang làm tải lại tài nguyên.
    2.  **Progressive Disclosure:** Ẩn các trường nhập liệu chưa cần thiết. Chỉ hiển thị đúng thông tin theo chế độ khách chọn.
    3.  **Zero-Map SDK:** Tuyệt đối không nhúng `iframe` Google Maps hay thư viện bản đồ nặng. Chỉ dùng `navigator.geolocation` lấy tọa độ GPS và tính khoảng cách bằng công thức toán học Haversine.

---

## 2. CẤU TRÚC DATABASE (SUPABASE / POSTGRESQL SCHEMA)

Hãy tạo file `supabase/schema.sql` và các TypeScript interfaces tương ứng với 5 bảng sau:

### 2.1. Bảng `store_settings` (Cấu hình quán - Admin chỉnh sửa được)
*   `id` (string/uuid, primary key)
*   `store_name` (text) - Mặc định: `"Tiệm Mì Indomie"`
*   `is_open` (boolean) - Công tắc Đóng/Mở quán nhận đơn.
*   `store_lat` (float8) - Vĩ độ của quán (để tính khoảng cách ship).
*   `store_lng` (float8) - Kinh độ của quán.
*   `max_delivery_km` (float8) - Bán kính giao hàng tối đa (VD: `5.0` km).
*   `shipping_fee_per_km` (integer) - Phí ship hoặc phí ship cố định (VD: `0` hoặc `10000`).
*   `bank_id` (text) - Mã ngân hàng VietQR (VD: `"MB"`, `"VCB"`).
*   `bank_account_no` (text) - Số tài khoản nhận tiền.
*   `bank_account_name` (text) - Tên chủ tài khoản.
*   `telegram_bot_token` (text) - Token của Bot Telegram nhận đơn.
*   `telegram_chat_id` (text) - Chat ID của chủ quán.
*   `admin_pin` (text) - Mã PIN đăng nhập trang `/admin` (Mặc định: `"123456"`).

### 2.2. Bảng `products` (Danh sách món chính - Admin thêm/sửa/xóa giá & ảnh)
*   `id` (uuid, primary key)
*   `name` (text) - VD: `"Mì Trộn Indomie Truyền Thống"`, `"Mì Trộn Indomie Đặc Biệt"`
*   `description` (text) - Mô tả ngắn gọn nguyên liệu.
*   `price` (integer) - Giá tiền (VNĐ), VD: `25000`.
*   `image_url` (text) - Link hình ảnh sản phẩm (Admin có thể dán link ảnh hoặc upload).
*   `is_available` (boolean) - Trạng thái Còn món / Hết món.
*   `sort_order` (integer) - Thứ tự hiển thị.

### 2.3. Bảng `toppings` (Danh sách Topping & Vắt mì thêm - Admin thêm/sửa/xóa giá & ảnh)
*   `id` (uuid, primary key)
*   `name` (text) - VD: `"Vắt mì Indomie thêm"`, `"Trứng ốp la lòng đào"`, `"Xúc xích khứa"`, `"Chả cá hàn quốc"`, `"Phô mai kéo sợi"`.
*   `price` (integer) - Giá tiền (VNĐ), VD: `10000`.
*   `image_url` (text) - Link hình ảnh của topping (Admin tùy chỉnh được).
*   `is_available` (boolean) - Trạng thái Còn / Hết topping.
*   `sort_order` (integer) - Thứ tự hiển thị.

### 2.4. Bảng `customers` (Tài khoản khách hàng "Tàng hình" định danh qua SĐT)
*   `phone` (text, primary key) - Số điện thoại khách hàng.
*   `name` (text) - Tên khách hàng.
*   `address` (text) - Địa chỉ giao hàng gần nhất.
*   `lat` (float8, nullable) - Vĩ độ gần nhất.
*   `lng` (float8, nullable) - Kinh độ gần nhất.
*   `total_orders` (integer) - Tổng số đơn đã đặt (dùng để báo khách quen & tích điểm).
*   `updated_at` (timestamp)

### 2.5. Bảng `orders` (Lịch sử đơn hàng)
*   `id` (uuid, primary key)
*   `order_code` (text) - Mã đơn ngắn gọn (VD: `#IND-042`).
*   `order_type` (text) - `'DINE_IN'` (Tại bàn/Mang đi) hoặc `'DELIVERY'` (Giao tận nơi).
*   `table_number` (text, nullable) - Số bàn (nếu ăn tại chỗ).
*   `customer_name` (text)
*   `customer_phone` (text)
*   `delivery_address` (text, nullable)
*   `lat` (float8, nullable)
*   `lng` (float8, nullable)
*   `distance_km` (float8, nullable)
*   `items` (jsonb) - Chi tiết mảng các món đã đặt, mỗi món gồm: `{ productId, productName, basePrice, quantity, selectedToppings: [{ id, name, price, quantity }], itemNote, subtotal }`.
*   `quick_notes` (text[]) - Các tag ghi chú chọn nhanh.
*   `custom_note` (text) - Ghi chú tự nhập.
*   `payment_method` (text) - `'CASH'` hoặc `'VIETQR'`.
*   `total_amount` (integer) - Tổng tiền thanh toán.
*   `status` (text) - `'PENDING'` | `'COOKING'` | `'DELIVERING'` | `'COMPLETED'` | `'CANCELLED'`.
*   `created_at` (timestamp)

---

## 3. CHI TIẾT GIAO DIỆN & LUỒNG NGƯỜI DÙNG (CUSTOMER FLOW - TRANG `/`)

### 3.1. Header & Thanh chuyển chế độ (Segmented Control)
*   **Header:** Tên tiệm, trạng thái hoạt động (Chấm xanh `"Đang mở cửa"` hoặc Chấm đỏ `"Tạm ngưng nhận đơn"`). Nếu quán đang đóng cửa, khóa nút Đặt hàng và hiện thông báo lịch sự.
*   **1-Click Reorder (Đặt lại đơn cũ):** Nếu trong `localStorage` có lưu đơn hàng trước đó của khách, hiển thị 1 thẻ Glassmorphism nhỏ gọn trên đầu: *"🍜 Đặt lại thực đơn lần trước của bạn (Tổng: XX.000đ) - [Bấm để thêm vào giỏ]"*.
*   **Segmented Control (Chuyển chế độ):**
    *   Nút gạt 2 tab lớn: `[ 🏪 Tại bàn / Mang đi ]` và `[ 🛵 Giao tận nơi ]`.
    *   Nếu URL có query `?table=3` (khi khách quét QR tại bàn số 3), tự động chọn chế độ `Tại bàn / Mang đi` và điền sẵn `"Bàn số 3"`.

### 3.2. Danh sách sản phẩm (Menu Grid)
*   Hiển thị các món trong bảng `products` dưới dạng thẻ sang trọng (có hình ảnh bo góc đẹp, tên món, mô tả ngắn, giá tiền định dạng `25.000đ`).
*   Nếu món nào có `is_available = false`, làm mờ thẻ và gắn nhãn `"Tạm hết"`.

### 3.3. Modal / Bottom Sheet Chọn Topping & Ghi chú (QUAN TRỌNG)
*   **Hành vi:** Khi khách bấm vào bất kỳ sản phẩm nào (hoặc nút `"+"` / `"Đặt món"` trên thẻ sản phẩm), **một Bottom Sheet (trên mobile) hoặc Modal (trên desktop) trượt lên mượt mà**.
*   **Nội dung bên trong Bottom Sheet này bao gồm:**
    1.  **Thông tin món chính:** Ảnh món ăn, Tên món, Giá gốc, và nút tăng giảm số lượng hộp (`- 1 +`).
    2.  **Khu vực "Thêm Vắt Mì & Topping":**
        *   Hiển thị danh sách toàn bộ các mục từ bảng `toppings` (chỉ hiện các topping đang `is_available = true`).
        *   Mỗi dòng Topping phải hiển thị rõ: **Hình ảnh nhỏ của Topping (bo góc)** + **Tên Topping** + **Giá cộng thêm (`+10.000đ`)** + **Bộ nút chọn/tăng giảm số lượng (`+` hoặc `- 1 +`)** để khách có thể gọi 1 hoặc nhiều phần topping cho hộp mì đó.
    3.  **Ghi chú nhanh cho hộp mì này (Quick-Tag Pills):**
        *   Các nút pill chạm để bật/tắt nhanh: `[Không hành]`, `[Ít cay]`, `[Thêm cay]`, `[Để sốt riêng]`, `[Trứng chín kỹ]`, `[Trứng lòng đào]`.
        *   1 ô input nhỏ bên dưới nếu khách muốn dặn riêng cho hộp này.
    4.  **Nút Sticky ở đáy Bottom Sheet:** `"Thêm vào giỏ hàng • {Tổng tiền hộp mì + các topping đã chọn}đ"`.

### 3.4. Giỏ hàng nổi (Floating Cart Bar) & Màn hình Xác nhận Đặt Hàng (Checkout Sheet)
*   Khi giỏ hàng có món, hiện một thanh Floating Bar dạng kính mờ ở đáy màn hình: *"Giỏ hàng (X món) • Tổng: XX.000đ — [Tiếp tục đặt hàng ->]"*.
*   Khi bấm vào thanh này, mở **Checkout Bottom Sheet** với cơ chế thông minh:
    *   **Nếu chế độ là `Tại bàn / Mang đi`:**
        *   Chỉ hiện ô nhập: `Số bàn / Tên của bạn` và `Số điện thoại (Tùy chọn để tích điểm)`. Ẩn toàn bộ phần địa chỉ và GPS.
    *   **Nếu chế độ là `Giao tận nơi`:**
        *   **Tài khoản Tàng hình:** Tự động điền `Tên`, `Số điện thoại`, `Địa chỉ` từ `localStorage`. Nếu khách nhập SĐT mới (đủ 10 số), tự động gọi API kiểm tra trong bảng `customers`. Nếu là khách cũ, tự điền Tên & Địa chỉ đã che một phần (`123/***...`) hoặc cho phép dùng lại địa chỉ cũ và hiện lời chào: *"Chào mừng bạn quay lại! Đây là đơn thứ {n} của bạn"*.
        *   **Định vị GPS siêu nhẹ (Zero-Lag):** Có nút `[📍 Lấy vị trí hiện tại của tôi]`. Khi bấm vào:
            *   Gọi `navigator.geolocation.getCurrentPosition`.
            *   Dùng công thức Haversine tính khoảng cách $d$ từ tọa độ khách $(\phi_1, \lambda_1)$ tới tọa độ quán $(\phi_2, \lambda_2)$ với bán kính Trái Đất $R = 6371\text{ km}$:
                $$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cdot\cos(\phi_2)\cdot\sin^2\left(\frac{\Delta \lambda}{2}\right)$$
                $$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
                $$d = R \cdot c$$
            *   Hiển thị khoảng cách (VD: `"Đã ghim GPS - Cách quán ~1.4 km"`). Nếu $d > \text{max\_delivery\_km}$, cảnh báo cho khách biết vượt quá bán kính giao hàng.
            *   Gọi API Nominatim (`https://nominatim.openstreetmap.org/reverse?format=json&lat=...&lon=...`) để gợi ý tên đường vào ô địa chỉ (khách vẫn sửa tay được).
        *   **Quick-Tag Ghi chú giao hàng:** `[Gọi trước khi giao]`, `[Tới nơi nhắn tin, đừng bấm chuông]`, `[Giao càng sớm càng tốt]`.
    *   **Phương thức thanh toán:**
        *   Chọn giữa `[ 💵 Tiền mặt (COD) ]` và `[ 🏦 Chuyển khoản VietQR ]`.
        *   Nếu chọn **VietQR**, tự động render thẻ `<img>` gọi link chuẩn của VietQR:
            `https://img.vietqr.io/image/${bank_id}-${bank_account_no}-compact2.png?amount=${total_amount}&addInfo=INDOMIE%20${order_code}&accountName=${encodeURIComponent(bank_account_name)}`
            Khách thấy ngay mã QR có sẵn số tiền và nội dung chuyển khoản.

---

## 4. TRANG QUẢN TRỊ CHO CHỦ QUÁN (`/admin`) - TÙY CHỈNH MỌI THỨ

Xây dựng trang `/admin` trực quan, gọn nhẹ, bảo vệ bằng mã PIN (`admin_pin`), cho phép chủ quán thao tác ngay trên điện thoại hoặc máy tính:

1.  **Tab 1 - Quản lý Đơn hàng Trực tiếp (Live Orders) & Trạng thái Quán:**
    *   Công tắc gạt lớn: **Mở cửa / Tạm đóng cửa**.
    *   Danh sách đơn hàng mới nhất, cho phép đổi trạng thái (`Đang nấu`, `Đang giao`, `Hoàn tất`, `Hủy`).
2.  **Tab 2 - Quản lý Món Chính (Products CRUD):**
    *   Danh sách các món mì hiện có.
    *   Chủ quán có thể **Thêm món mới**, **Sửa tên, Sửa mô tả, Đổi giá tiền**, **Đổi hình ảnh sản phẩm** (hỗ trợ cả dán URL ảnh lẫn chọn ảnh từ máy/điện thoại chuyển sang Base64 hoặc upload lên Supabase Storage), và **Gạt nút Còn hàng / Hết hàng** tức thì.
3.  **Tab 3 - Quản lý Topping (Toppings CRUD):**
    *   Danh sách toàn bộ các Topping.
    *   Chủ quán có thể **Thêm Topping mới**, **Đổi tên Topping**, **Đổi giá tiền Topping**, **Đổi hình ảnh Topping** (URL hoặc Upload ảnh trực tiếp), và **Gạt nút Còn / Hết Topping** tức thì.
4.  **Tab 4 - Cấu hình Quán, VietQR & Telegram Bot:**
    *   Chỉnh sửa thông tin Ngân hàng (Mã NH, Số TK, Tên chủ TK) để tạo mã VietQR.
    *   Nút `"📍 Cập nhật tọa độ quán tại vị trí tôi đang đứng"` + chỉnh bán kính giao hàng tối đa (km) & phí ship.
    *   Ô nhập `Telegram Bot Token` và `Telegram Chat ID` kèm nút `"Gửi tin nhắn Test về điện thoại"`.
    *   Công cụ tạo nhanh mã QR cho từng bàn (nhập số bàn -> hiển thị mã QR dẫn tới link web kèm `?table=X` để chủ quán tải về in dán lên bàn).

---

## 5. BACKEND API & TÍCH HỢP TELEGRAM BOT (`POST /api/orders`)

Khi khách bấm **"Chốt Đơn Hàng"**:
1.  Lưu/Cập nhật thông tin khách vào bảng `customers` (tăng `total_orders` lên $1$).
2.  Lưu đơn hàng vào bảng `orders`.
3.  Gửi ngay lập tức một HTTP POST request tới Telegram Bot API (`https://api.telegram.org/bot<TOKEN>/sendMessage`) với `parse_mode: "HTML"` theo đúng mẫu sau:

```text
🚨 <b>ĐƠN HÀNG MỚI (#IND-042)</b>
🏷️ Loại đơn: <b>🛵 GIAO TẬN NƠI</b> (hoặc 🏪 TẠI BÀN SỐ 3)
────────────────────
👤 Khách: <b>Minh Khoa</b> (⭐ Đơn thứ 4)
📞 SĐT: <a href="tel:0901234567">0901234567</a>
📍 Địa chỉ: Hẻm 45, đối diện tiệm tạp hóa
🗺️ Định vị: <a href="https://www.google.com/maps?q=10.762622,106.660172">📍 Bấm mở Google Maps chỉ đường</a> (~1.2 km)

🍜 <b>CHI TIẾT MÓN ĐẶT:</b>
<b>1. Mì Trộn Indomie Đặc Biệt (x1)</b> - 30.000đ
   + Topping: Vắt mì thêm (x1 - 10.000đ), Trứng lòng đào (x1 - 10.000đ)
   + Ghi chú món: Không hành, Thêm cay

📝 <b>GHI CHÚ CHUNG:</b>
[Gọi trước khi giao] - "Tới đầu hẻm nhá máy mình chạy ra lấy nha"
────────────────────
💳 Thanh toán: <b>Chuyển khoản VietQR (hoặc Tiền mặt)</b>
💰 <b>TỔNG THU: 50.000đ</b>
```

4.  Sau khi đặt thành công, chuyển giao diện của khách sang **Màn hình Hóa đơn & Theo dõi trạng thái đơn hàng** (hiển thị mã đơn, tóm tắt món, mã VietQR nếu khách chọn chuyển khoản mà chưa quét kịp, và trạng thái đơn hàng).

---

## 6. YÊU CẦU THỰC THI DÀNH CHO ANTIGRAVITY

1.  **Khởi tạo dữ liệu mẫu (Seed Data) sẵn sàng 100%:** Ngay khi chạy `npm run dev`, trang web phải hiển thị sẵn danh sách 3–4 món Mì Trộn Indomie hấp dẫn và 6–8 loại Topping (Vắt mì thêm, Trứng lòng đào, Xúc xích, Chả cá, Bò viên, Phô mai...) kèm hình ảnh minh họa chất lượng cao và giá tiền chuẩn để chủ quán có thể trải nghiệm ngay lập tức trước khi vào `/admin` tự thay ảnh và giá của mình.
2.  **Hoàn thiện cả 2 chế độ lưu trữ:** Thiết kế lớp Data Access sao cho nếu chưa cấu hình biến môi trường Supabase, toàn bộ việc thêm/sửa/xóa sản phẩm, giá, hình ảnh, topping trong `/admin` và tạo đơn hàng vẫn hoạt động mượt mà thông qua Local JSON / API State + LocalStorage, và tự động chuyển sang Supabase Database ngay khi điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3.  **Code sạch, không lỗi TypeScript:** Đảm bảo mọi component đều responsive hoàn hảo trên màn hình điện thoại (Mobile-First). Hãy bắt đầu khởi tạo cấu trúc dự án và viết code hoàn chỉnh cho từng file ngay bây giờ!