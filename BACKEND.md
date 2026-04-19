# Backend Design — Claude Shop MVP

> **Stack**: Next.js 16 App Router (Route Handlers + Server Actions)
> **DB**: Neon Postgres + Drizzle
> **Email**: Resend
> **Deploy**: Vercel

---

## 1. Kiến trúc tổng quan

```
┌────────────────────────────────────────────────────────────┐
│                       Next.js App                          │
│                                                            │
│  Public pages            Admin pages           API routes  │
│  (Server Comp.)          (Server Comp.)        (Handlers)  │
│       │                       │                     │      │
│       ▼                       ▼                     ▼      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Service layer (lib/services)             │ │
│  │  order-service · stock-service · product-service      │ │
│  │  warranty-service · email-service · crypto            │ │
│  └───────────────────────────────────────────────────────┘ │
│       │                                                    │
│       ▼                                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │         Drizzle ORM  →  Neon Postgres                 │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
                                │
                                ▼
                        Resend (email giao hàng)
```

**Nguyên tắc**:
- **Service layer** chứa logic nghiệp vụ — gọi được từ Server Action, Route Handler, hoặc cron.
- Route Handler chỉ làm validation + gọi service + trả response.
- Tất cả mutation dùng transaction (`db.transaction`) khi động chạm nhiều bảng.

---

## 2. Cấu trúc thư mục

```
src/
├── app/
│   ├── (shop)/                    # Public routes
│   │   ├── page.tsx               # Home + catalog
│   │   ├── products/[slug]/       # Chi tiết sản phẩm
│   │   ├── checkout/              # Form checkout
│   │   ├── orders/[code]/         # Tra cứu đơn
│   │   └── warranty/[code]/       # Form yêu cầu bảo hành
│   │
│   ├── admin/                     # Admin routes (bảo vệ bằng middleware)
│   │   ├── login/
│   │   ├── orders/                # List + detail đơn hàng
│   │   ├── stock/                 # Quản lý kho
│   │   ├── products/              # CRUD sản phẩm
│   │   └── warranty/              # Xử lý yêu cầu bảo hành
│   │
│   └── api/                       # Route handlers
│       ├── orders/                # Create order, lookup
│       ├── admin/                 # Admin operations
│       └── webhooks/              # (tương lai: bank webhook)
│
├── lib/
│   ├── db/
│   │   ├── schema.ts              # Drizzle schema
│   │   ├── index.ts               # db client
│   │   └── seed.ts
│   ├── services/
│   │   ├── product-service.ts
│   │   ├── order-service.ts
│   │   ├── stock-service.ts
│   │   ├── warranty-service.ts
│   │   └── email-service.ts
│   ├── crypto.ts                  # AES-GCM encrypt/decrypt
│   ├── auth.ts                    # admin JWT helpers
│   ├── validators.ts              # Zod schemas
│   ├── utils.ts                   # format VND, gen order code
│   └── rate-limit.ts
│
├── middleware.ts                  # Bảo vệ /admin/*
│
└── emails/                        # React Email templates
    ├── order-delivered.tsx
    └── warranty-resolved.tsx
```

---

## 3. Data flow chính

### 3.1. Tạo đơn hàng (khách đặt)

```
[Client] POST /api/orders
         body: { items: [{productId, qty}], email, phone, note }
    │
    ▼
[Validator]  Zod schema (email hợp lệ, qty > 0, productId tồn tại)
    │
    ▼
[Rate limit] IP-based: 5 đơn / 10 phút
    │
    ▼
[order-service.createOrder]
    ├── tra products → tính total (snapshot giá)
    ├── kiểm available stock đủ cho từng product
    ├── db.transaction:
    │     1. insert `orders` (status=pending, gen order_code)
    │     2. insert `order_items` (1 row / quantity unit)
    │     3. KHÔNG reserve stock ở bước này — stock chỉ bị khoá khi admin confirm paid
    │     (Chọn cách này cho đơn giản: ngăn race bằng lock khi giao, không khi đặt.)
    └── return { orderCode, total, bankInfo }
    │
    ▼
[Response]   { orderCode, qrUrl, amount, expiresAt }
             → render trang QR cho khách chuyển khoản
```

> **Alternative** (nếu lo out-of-stock khi khách đang chuyển tiền): giữ stock dạng `reserved` với TTL 30 phút, có cron dọn. MVP bỏ qua.

---

### 3.2. Admin xác nhận đã thanh toán → giao hàng

```
[Admin UI] click "Xác nhận đã thanh toán" trên /admin/orders/[id]
    │
    ▼
[Server Action] confirmPaidAction(orderId)
    │
    ▼
[order-service.markPaidAndDeliver]
    └── db.transaction:
          1. lock order FOR UPDATE, kiểm status = 'pending'
          2. cho mỗi order_item chưa có delivered_stock_id:
             - SELECT 1 stock `available` của product_id đó
               FOR UPDATE SKIP LOCKED  ← chống race admin click 2 lần
             - UPDATE stock SET status='sold', sold_order_id, sold_at=now()
             - UPDATE order_item SET delivered_stock_id
          3. UPDATE order SET status='delivered', paid_at, delivered_at,
                              warranty_until = now() + max(warranty_days)
          4. decrypt credentials → gọi email-service.sendDelivery
    │
    ▼
[email-service] Resend gửi email "Đơn hàng đã giao" + credentials
    │
    ▼
[Revalidate] revalidatePath('/admin/orders'), '/orders/[code]'
```

**Chống race**: `FOR UPDATE SKIP LOCKED` + check status trong transaction. Nếu stock không đủ → rollback + báo admin "Hết hàng SKU X, nạp thêm rồi giao".

---

### 3.3. Khách tra cứu đơn

```
GET /orders/[code]?email=<email>
    │
    ▼
[order-service.lookupByCode]
    ├── SELECT order JOIN order_items JOIN products WHERE order_code = ?
    ├── kiểm email khớp (case-insensitive) → anti-enumeration
    └── nếu status = 'delivered': decrypt credentials để hiển thị
    │
    ▼
[UI]  Bảng: sản phẩm | credential (có nút Copy) | bảo hành đến ngày ...
      Nếu còn hạn bảo hành → nút "Yêu cầu bảo hành"
```

**Rate limit**: 10 req / phút / IP cho route lookup (chống dò mã).

---

### 3.4. Khách yêu cầu bảo hành

```
POST /api/warranty
     body: { orderCode, email, orderItemId, reason }
    │
    ▼
[warranty-service.openClaim]
    ├── verify order_code + email khớp
    ├── verify order_item thuộc order, còn hạn warranty_until, chưa có open claim
    └── INSERT warranty_claims (status='open', old_stock_id = order_item.delivered_stock_id)
    │
    ▼
[Admin UI /admin/warranty] thấy ticket mới → bấm "Đổi account"
    │
    ▼
[warranty-service.resolveClaim]
    └── db.transaction:
          1. SELECT 1 stock available của cùng product FOR UPDATE SKIP LOCKED
          2. UPDATE cũ: status='disabled'
          3. UPDATE mới: status='sold', sold_order_id
          4. UPDATE order_item.delivered_stock_id = new
          5. UPDATE claim: status='resolved', new_stock_id, resolved_at
          6. gửi email "Bảo hành đã xử lý" kèm credential mới
```

---

## 4. API endpoints

### Public

| Method | Path                          | Mô tả                                             |
|--------|-------------------------------|---------------------------------------------------|
| GET    | `/` (RSC)                     | Home + catalog (không cần API)                    |
| GET    | `/products/[slug]` (RSC)      | Chi tiết                                          |
| POST   | `/api/orders`                 | Tạo đơn → trả order_code + QR                     |
| GET    | `/api/orders/[code]?email=`   | Tra cứu đơn (hoặc RSC `/orders/[code]`)           |
| POST   | `/api/warranty`               | Mở ticket bảo hành                                |

### Admin (cần cookie `admin_session`)

| Method | Path                                  | Mô tả                                        |
|--------|---------------------------------------|----------------------------------------------|
| POST   | `/api/admin/login`                    | Nhận password, set cookie                    |
| POST   | `/api/admin/logout`                   |                                              |
| POST   | `/api/admin/orders/[id]/confirm`      | Mark paid + giao hàng                        |
| POST   | `/api/admin/orders/[id]/cancel`       | Huỷ đơn                                      |
| POST   | `/api/admin/stock`                    | Thêm credential (bulk paste)                 |
| PATCH  | `/api/admin/stock/[id]`               | Sửa note / disable                           |
| POST   | `/api/admin/products`                 | Tạo sản phẩm                                 |
| PATCH  | `/api/admin/products/[id]`            | Sửa giá, bật/tắt                             |
| POST   | `/api/admin/warranty/[id]/resolve`    | Đổi account                                  |
| POST   | `/api/admin/warranty/[id]/reject`     | Từ chối bảo hành                             |

> Ưu tiên **Server Actions** cho admin mutations (type-safe, ít boilerplate).
> Chỉ tạo Route Handler khi cần gọi từ client-side hook/SWR.

---

## 5. Authentication — Admin

**MVP đơn giản**:
- 1 password duy nhất lưu ở env `ADMIN_PASSWORD_HASH` (bcrypt hash).
- Login: so sánh password → cấp **JWT** ký bằng `ADMIN_JWT_SECRET`, payload `{ role: 'admin', iat, exp }`, hết hạn 7 ngày.
- Lưu JWT ở cookie `admin_session`: `httpOnly`, `secure`, `sameSite=lax`, `path=/`.
- `middleware.ts` match `/admin/:path*` và `/api/admin/:path*` → verify JWT, redirect `/admin/login` nếu fail.

```ts
// middleware.ts (khung)
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }

export async function middleware(req) {
  if (req.nextUrl.pathname.startsWith('/admin/login')) return NextResponse.next()
  const token = req.cookies.get('admin_session')?.value
  const ok = token && await verifyAdminJWT(token)
  if (!ok) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}
```

> Middleware chạy ở Edge — `verifyAdminJWT` dùng `jose` (Web Crypto), không dùng `bcrypt` ở edge.

---

## 6. Service layer (API contracts)

### `product-service.ts`

```ts
listActiveProducts(): Promise<Product[]>
getProductBySlug(slug: string): Promise<Product | null>
createProduct(input: CreateProductInput): Promise<Product>        // admin
updateProduct(id: string, patch: UpdateProductInput): Promise<Product>
```

### `stock-service.ts`

```ts
listStock(productId?: string, status?: StockStatus): Promise<StockRow[]>      // admin
addStockBulk(productId: string, credentials: string[]): Promise<{ inserted: number }>  // admin, encrypt trước khi lưu
disableStock(id: string): Promise<void>
countAvailable(productId: string): Promise<number>
```

### `order-service.ts`

```ts
createOrder(input: CreateOrderInput): Promise<{ orderCode: string; totalVnd: number }>
markPaidAndDeliver(orderId: string): Promise<{ deliveredItems: DeliveredItem[] }>  // admin
cancelOrder(orderId: string, reason?: string): Promise<void>
lookupByCode(code: string, email: string): Promise<OrderDetail | null>  // decrypt creds nếu delivered
listOrders(filter: { status?: OrderStatus; page: number }): Promise<Paginated<Order>>  // admin
```

### `warranty-service.ts`

```ts
openClaim(input: { orderCode; email; orderItemId; reason }): Promise<Claim>
listClaims(status?: ClaimStatus): Promise<Claim[]>  // admin
resolveClaim(claimId: string): Promise<{ newCredential: string }>
rejectClaim(claimId: string, note?: string): Promise<void>
```

### `email-service.ts`

```ts
sendDelivery(order: OrderDetail, items: { productName; credential }[]): Promise<void>
sendWarrantyResolved(order: OrderDetail, newCredential: string): Promise<void>
```

---

## 7. Validation (Zod)

```ts
// lib/validators.ts
export const CreateOrderSchema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^[0-9+\- ]{8,15}$/).optional(),
  note: z.string().max(500).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
  })).min(1),
})

export const WarrantyClaimSchema = z.object({
  orderCode: z.string().regex(/^CLS-[A-Z0-9]{6}$/),
  email: z.string().email(),
  orderItemId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
})
```

Tất cả input từ client **bắt buộc** đi qua Zod trước khi chạm service.

---

## 8. Rate limiting

- Dùng **Upstash Redis** (marketplace) + `@upstash/ratelimit` HOẶC đơn giản là **in-memory LRU** cho MVP (mất khi restart, nhưng đủ chống spam).
- Áp dụng:
  - `POST /api/orders`: 5 / 10min / IP
  - `GET /orders/[code]`: 10 / 1min / IP
  - `POST /api/admin/login`: 5 / 15min / IP (chống brute force)

---

## 9. Tiện ích

### 9.1. Sinh `order_code`

```ts
// CLS-{6 ký tự base32 không nhầm lẫn (bỏ 0/O/1/I)}
function genOrderCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => alphabet[b % alphabet.length]).join('')
  return `CLS-${chars}`
}
```
Retry tối đa 3 lần nếu đụng UNIQUE.

### 9.2. QR chuyển khoản

- Dùng **VietQR** URL trực tiếp:
  `https://img.vietqr.io/image/{BANK_BIN}-{ACCOUNT_NO}-compact2.png?amount={total}&addInfo={orderCode}&accountName={NAME}`
- Thông tin ngân hàng lưu ở env: `BANK_BIN`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME`.

### 9.3. Crypto

```ts
// lib/crypto.ts
export function encryptCredential(plain: string): string
export function decryptCredential(encoded: string): string
// AES-256-GCM, key = base64-decode(STOCK_ENCRYPTION_KEY)
```

---

## 10. Environment variables

| Key                       | Mô tả                                                   |
|---------------------------|---------------------------------------------------------|
| `DATABASE_URL`            | Neon Postgres connection string (pooled)                |
| `DATABASE_URL_UNPOOLED`   | For migrations                                          |
| `ADMIN_PASSWORD_HASH`     | bcrypt hash của password admin                          |
| `ADMIN_JWT_SECRET`        | random 32+ byte                                         |
| `STOCK_ENCRYPTION_KEY`    | AES-256 key (base64, 32 byte)                           |
| `RESEND_API_KEY`          | Gửi email                                               |
| `RESEND_FROM`             | `Claude Shop <no-reply@yourdomain.com>`                 |
| `BANK_BIN`                | VietQR bank ID                                          |
| `BANK_ACCOUNT_NO`         |                                                         |
| `BANK_ACCOUNT_NAME`       |                                                         |
| `NEXT_PUBLIC_SITE_URL`    | Cho link trong email                                    |
| `UPSTASH_REDIS_REST_URL`  | (Optional) rate limit                                   |
| `UPSTASH_REDIS_REST_TOKEN`|                                                         |

---

## 11. Lỗi & response format

```ts
// Success
{ ok: true, data: {...} }

// Error
{ ok: false, error: { code: 'VALIDATION' | 'NOT_FOUND' | 'OUT_OF_STOCK' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'INTERNAL', message: string, fieldErrors?: {...} } }
```

HTTP status: 200/201 success, 400 validation, 401/403 auth, 404 not found, 409 conflict (out of stock, duplicate), 429 rate limit, 500 internal.

---

## 12. Logging

- MVP: `console.log` + Vercel Runtime Logs là đủ.
- Log mỗi mutation quan trọng: `order.created`, `order.delivered`, `stock.added`, `warranty.resolved` — ở dạng JSON 1 dòng để dễ filter.

---

## 13. Cron (Vercel Cron — sau MVP)

- `0 2 * * *` — cảnh báo các `orders.status='pending'` quá 48h → gửi email nhắc hoặc auto-cancel.
- `0 3 * * *` — log cảnh báo SKU có `countAvailable < 3`.

---

## 14. Triển khai từng bước (build order)

1. **Setup**: Next.js 16 + Drizzle + Neon + shadcn/ui theo DESIGN.md
2. **DB**: schema + migration + seed 3 products
3. **Crypto utility** + test encrypt/decrypt
4. **Service layer** (stubs + logic)
5. **Admin auth** (middleware + login page)
6. **Admin stock + products** (CRUD đơn giản trước)
7. **Public catalog + product detail**
8. **Checkout + QR + lookup đơn**
9. **Admin orders list + confirm paid flow**
10. **Email delivery** (Resend)
11. **Warranty flow** (form khách + resolve admin)
12. **Rate limit + hardening**
13. **Polish UI + deploy Vercel**

---

## 15. Không làm ở MVP (ghi nhận)

- User account / đăng nhập khách
- Bank webhook tự động xác nhận (vẫn cần admin bấm)
- Coupon, referral
- Đa ngôn ngữ
- Analytics / dashboard doanh thu (chỉ cần list đơn là đủ)
