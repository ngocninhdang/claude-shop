# Database Design — Claude Shop MVP

> **Stack**: Neon Postgres + Drizzle ORM
> **Nguyên tắc**: đơn giản, đủ dùng cho MVP, dễ mở rộng sau.

---

## 1. Sơ đồ quan hệ (ERD)

```
products (1) ─── (N) account_stock
   │
   └── (N) order_items (N) ─── (1) orders
                                  │
                                  └── delivered_stock_id → account_stock
```

- Một **product** có nhiều **account_stock** (credential pool cho SKU đó)
- Một **order** có nhiều **order_items** (mỗi item là 1 credential được giao)
- Mỗi **order_item** trỏ tới 1 dòng **account_stock** đã được giao

---

## 2. Bảng chi tiết

### 2.1. `products` — Danh mục sản phẩm

| Cột              | Kiểu           | Ràng buộc           | Ghi chú                                          |
|------------------|----------------|---------------------|--------------------------------------------------|
| `id`             | uuid           | PK, default gen     | Khoá chính                                       |
| `slug`           | text           | UNIQUE, NOT NULL    | URL-friendly, vd: `claude-x5`                    |
| `name`           | text           | NOT NULL            | Tên hiển thị: "Claude x5 – Bảo hành 30 ngày"     |
| `description`    | text           | NULL                | Mô tả dài (markdown được)                        |
| `price_vnd`      | integer        | NOT NULL            | Giá VND (2300000)                                |
| `product_type`   | text (enum)    | NOT NULL            | `credential` \| `giftcode`                       |
| `warranty_days`  | integer        | NOT NULL, default 0 | 0 = không bảo hành, 30 = bảo hành 30 ngày        |
| `is_active`      | boolean        | NOT NULL, default T | Tắt để ẩn khỏi shop                              |
| `sort_order`     | integer        | default 0           | Sắp xếp hiển thị                                 |
| `created_at`     | timestamptz    | default now()       |                                                  |
| `updated_at`     | timestamptz    | default now()       | Trigger update khi sửa                           |

**Seed 3 sản phẩm ban đầu:**
- `claude-x5` — Claude x5 — 2,300,000đ — `credential` — warranty 30
- `claude-20x` — Claude 20x (Giftcode) — 2,500,000đ — `giftcode` — warranty 0
- `claude-pro-team` — Claude Pro (Add Team) — 370,000đ — `credential` — warranty 30

---

### 2.2. `account_stock` — Kho credential / giftcode

| Cột                 | Kiểu           | Ràng buộc                | Ghi chú                                                    |
|---------------------|----------------|--------------------------|------------------------------------------------------------|
| `id`                | uuid           | PK                       |                                                            |
| `product_id`        | uuid           | FK → products.id, NN     | Thuộc SKU nào                                              |
| `credential`        | text           | NOT NULL                 | **Encrypted** (AES-GCM). Dạng: `email:pass` hoặc giftcode  |
| `status`            | text (enum)    | NOT NULL, default 'available' | `available` \| `reserved` \| `sold` \| `disabled`      |
| `note`              | text           | NULL                     | Ghi chú nội bộ (vd: "acc cũ dùng 2 tháng")                 |
| `sold_at`           | timestamptz    | NULL                     | Set khi chuyển sang `sold`                                 |
| `sold_order_id`     | uuid           | FK → orders.id, NULL     | Đơn nào đã nhận credential này                             |
| `created_at`        | timestamptz    | default now()            |                                                            |

**Index**:
- `idx_stock_available` ON `(product_id, status)` WHERE `status = 'available'` — để query nhanh khi bán
- `idx_stock_order` ON `(sold_order_id)` — tra cứu ngược

**Quy tắc status**:
- Khi tạo → `available`
- Khi admin bấm "Giao hàng" → transaction: `available` → `sold` + set `sold_order_id`, `sold_at`
- Nếu cần gỡ → `disabled` (không xoá, giữ audit)

---

### 2.3. `orders` — Đơn hàng

| Cột                | Kiểu         | Ràng buộc                | Ghi chú                                                   |
|--------------------|--------------|--------------------------|-----------------------------------------------------------|
| `id`               | uuid         | PK                       |                                                           |
| `order_code`       | text         | UNIQUE, NOT NULL         | Mã hiển thị ngắn: `CLS-A7F3K2` (dùng để tra cứu)          |
| `customer_email`   | text         | NOT NULL                 | Nơi gửi credential                                        |
| `customer_phone`   | text         | NULL                     | Optional                                                  |
| `customer_note`    | text         | NULL                     | Khách nhắn                                                |
| `total_vnd`        | integer      | NOT NULL                 | Tổng tiền (snapshot khi tạo)                              |
| `status`           | text (enum)  | NOT NULL, default 'pending' | `pending` \| `paid` \| `delivered` \| `cancelled` \| `refunded` |
| `payment_method`   | text         | default 'bank_transfer'  | Để dành mở rộng                                           |
| `paid_at`          | timestamptz  | NULL                     |                                                           |
| `delivered_at`     | timestamptz  | NULL                     |                                                           |
| `warranty_until`   | timestamptz  | NULL                     | Tính = delivered_at + max(warranty_days trong items)      |
| `created_at`       | timestamptz  | default now()            |                                                           |
| `updated_at`       | timestamptz  | default now()            |                                                           |

**Index**:
- UNIQUE `order_code`
- `idx_orders_status` ON `(status, created_at DESC)` — list trong admin
- `idx_orders_email` ON `(customer_email)` — tra cứu

**State machine**:
```
pending ──admin xác nhận──▶ paid ──auto/admin giao──▶ delivered
   │                                                     │
   └──────── cancelled                                   └──▶ (bảo hành: đổi stock, không đổi state)
                                                              refunded (nếu huỷ sau giao)
```

---

### 2.4. `order_items` — Từng dòng trong đơn

| Cột                   | Kiểu        | Ràng buộc             | Ghi chú                                           |
|-----------------------|-------------|-----------------------|---------------------------------------------------|
| `id`                  | uuid        | PK                    |                                                   |
| `order_id`            | uuid        | FK → orders.id, NN    | CASCADE DELETE                                    |
| `product_id`          | uuid        | FK → products.id, NN  |                                                   |
| `product_name_snapshot` | text      | NOT NULL              | Snapshot tên lúc mua (phòng sửa tên product)      |
| `unit_price_vnd`      | integer     | NOT NULL              | Snapshot giá                                      |
| `quantity`            | integer     | NOT NULL, default 1   | MVP cho phép mua > 1                              |
| `delivered_stock_id`  | uuid        | FK → account_stock.id, NULL | Credential được giao cho line này           |
| `created_at`          | timestamptz | default now()         |                                                   |

> **Lưu ý**: Nếu `quantity > 1`, tách thành nhiều row `order_items` (mỗi row 1 credential riêng) — đơn giản hoá logic giao hàng.

---

### 2.5. `warranty_claims` — Yêu cầu bảo hành

| Cột                  | Kiểu        | Ràng buộc             | Ghi chú                                         |
|----------------------|-------------|-----------------------|-------------------------------------------------|
| `id`                 | uuid        | PK                    |                                                 |
| `order_item_id`      | uuid        | FK → order_items.id   | Line nào yêu cầu bảo hành                       |
| `reason`             | text        | NOT NULL              | Lý do khách ghi                                 |
| `status`             | text (enum) | NOT NULL, default 'open' | `open` \| `resolved` \| `rejected`           |
| `old_stock_id`       | uuid        | FK → account_stock.id | Credential cũ (bị lỗi)                          |
| `new_stock_id`       | uuid        | FK → account_stock.id, NULL | Credential mới đã đổi                     |
| `admin_note`         | text        | NULL                  |                                                 |
| `created_at`         | timestamptz | default now()         |                                                 |
| `resolved_at`        | timestamptz | NULL                  |                                                 |

---

### 2.6. `admin_sessions` *(tuỳ chọn — có thể dùng cookie signed thay thế)*

| Cột           | Kiểu        | Ràng buộc       | Ghi chú                         |
|---------------|-------------|-----------------|---------------------------------|
| `id`          | uuid        | PK              |                                 |
| `token_hash`  | text        | UNIQUE, NN      | SHA256 của session token        |
| `expires_at`  | timestamptz | NOT NULL        |                                 |
| `created_at`  | timestamptz | default now()   |                                 |

> MVP có thể skip bảng này, dùng **1 password trong env + JWT cookie**.

---

## 3. Enum list (tổng hợp)

```ts
// products.product_type
'credential' | 'giftcode'

// account_stock.status
'available' | 'reserved' | 'sold' | 'disabled'

// orders.status
'pending' | 'paid' | 'delivered' | 'cancelled' | 'refunded'

// warranty_claims.status
'open' | 'resolved' | 'rejected'
```

---

## 4. Encryption plan cho `account_stock.credential`

- Dùng **AES-256-GCM**, key lưu ở env `STOCK_ENCRYPTION_KEY` (32 byte base64)
- Lưu dạng: `iv(12) || ciphertext || authTag(16)` — encode base64
- Helper: `encryptCredential(plain)` / `decryptCredential(encoded)`
- Chỉ decrypt ở server, đúng lúc:
  - Admin xem chi tiết 1 stock (hiếm)
  - Gửi email giao hàng
  - Hiển thị ở trang tra cứu đơn (kèm CAPTCHA/rate-limit)

---

## 5. Quy tắc migration (Drizzle)

- 1 migration khởi tạo tất cả bảng + enum + index
- Seed bằng script `db/seed.ts`: tạo 3 products mặc định, 1 admin password hash (nếu dùng bảng admin).

---

## 6. Quyết định đã chốt

| Quyết định                           | Lý do                                                        |
|--------------------------------------|--------------------------------------------------------------|
| UUID thay vì auto-increment          | Khó đoán, dễ expose qua API                                  |
| `order_code` ngắn, public-facing     | Dễ copy/paste cho khách                                      |
| Snapshot `product_name` + giá ở item | Đổi giá/tên không ảnh hưởng đơn cũ                           |
| Encrypt credential                   | Rò rỉ DB không lộ credential                                 |
| `quantity>1 → tách row`              | Logic giao hàng đơn giản, audit rõ ràng                      |
| Soft disable stock (không xoá)       | Giữ audit khi tranh chấp                                     |

---

## 7. Ước lượng volume

- ~100 đơn/ngày → **~3k rows orders/tháng** — Postgres dư sức
- Kho stock ~vài trăm credential — hoàn toàn không cần shard/partition

---

## 8. Mở rộng tương lai (không làm ở MVP)

- `users` (nếu muốn tài khoản khách)
- `coupons`
- `refunds` / `payment_logs` (ghi nhận từng giao dịch ngân hàng)
- `audit_logs` (admin đã đổi stock nào, khi nào)
