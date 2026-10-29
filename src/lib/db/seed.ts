import type { Product, StoreSettings, Topping } from "../types";

/** Fixed IDs so the local JSON store and supabase/schema.sql seed stay in sync. */
export const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export const SEED_SETTINGS: StoreSettings = {
  id: SETTINGS_ID,
  store_name: "Tiệm Mì Indomie",
  is_open: true,
  store_lat: 10.7769,
  store_lng: 106.7009,
  max_delivery_km: 5,
  shipping_fee_per_km: 5000,
  bank_id: "MB",
  bank_account_no: "0123456789",
  bank_account_name: "TIEM MI INDOMIE",
  telegram_bot_token: "",
  telegram_chat_id: "",
  admin_pin: "123456",
};

export const SEED_PRODUCTS: Product[] = [
  {
    id: "11111111-1111-4111-8111-000000000001",
    name: "Mì Trộn Indomie Truyền Thống",
    description:
      "Sợi mì dai óng sốt xì dầu ngọt Indonesia, hành phi giòn rụm, hành lá & trứng ốp la.",
    price: 25000,
    image_url: "/images/mi_truyen_thong.jpg",
    is_available: true,
    sort_order: 1,
  },
  {
    id: "11111111-1111-4111-8111-000000000002",
    name: "Mì Trộn Indomie Đặc Biệt",
    description:
      "Full topping: trứng lòng đào, xúc xích nướng, chả cá Hàn Quốc, bò viên, mè rang.",
    price: 39000,
    image_url: "/images/mi_dac_biet.jpg",
    is_available: true,
    sort_order: 2,
  },
  {
    id: "11111111-1111-4111-8111-000000000003",
    name: "Mì Trộn Cay Hàn Quốc",
    description:
      "Sốt gochujang cay nồng, dầu ớt thơm, mè rang, ớt tươi và trứng ngâm tương.",
    price: 32000,
    image_url: "/images/mi_cay_han_quoc.jpg",
    is_available: true,
    sort_order: 3,
  },
  {
    id: "11111111-1111-4111-8111-000000000004",
    name: "Mì Trộn Phô Mai Kéo Sợi",
    description:
      "Mozzarella nướng chảy kéo sợi phủ kín mì trộn, trứng ốp la viền giòn.",
    price: 35000,
    image_url: "/images/mi_pho_mai.jpg",
    is_available: true,
    sort_order: 4,
  },
];

export const SEED_TOPPINGS: Topping[] = [
  {
    id: "22222222-2222-4222-8222-000000000001",
    name: "Vắt mì Indomie thêm",
    price: 10000,
    image_url: "/images/tp_vat_mi.jpg",
    is_available: true,
    sort_order: 1,
  },
  {
    id: "22222222-2222-4222-8222-000000000002",
    name: "Trứng ốp la",
    price: 6000,
    image_url: "/images/tp_trung_op_la.jpg",
    is_available: true,
    sort_order: 2,
  },
  {
    id: "22222222-2222-4222-8222-000000000003",
    name: "Trứng lòng đào ngâm tương",
    price: 8000,
    image_url: "/images/tp_trung_long_dao.jpg",
    is_available: true,
    sort_order: 3,
  },
  {
    id: "22222222-2222-4222-8222-000000000004",
    name: "Xúc xích khứa nướng",
    price: 10000,
    image_url: "/images/tp_xuc_xich.jpg",
    is_available: true,
    sort_order: 4,
  },
  {
    id: "22222222-2222-4222-8222-000000000005",
    name: "Chả cá Hàn Quốc",
    price: 10000,
    image_url: "/images/tp_cha_ca.jpg",
    is_available: true,
    sort_order: 5,
  },
  {
    id: "22222222-2222-4222-8222-000000000006",
    name: "Bò viên",
    price: 10000,
    image_url: "/images/tp_bo_vien.jpg",
    is_available: true,
    sort_order: 6,
  },
  {
    id: "22222222-2222-4222-8222-000000000007",
    name: "Phô mai kéo sợi",
    price: 12000,
    image_url: "/images/tp_pho_mai.jpg",
    is_available: true,
    sort_order: 7,
  },
  {
    id: "22222222-2222-4222-8222-000000000008",
    name: "Kim chi cải thảo",
    price: 7000,
    image_url: "/images/tp_kim_chi.jpg",
    is_available: true,
    sort_order: 8,
  },
];
