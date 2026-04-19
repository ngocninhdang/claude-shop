# Claude Shop

Web bán tài khoản Claude — giao tự động, bảo hành rõ ràng.

- Design reference: `DESIGN.md`
- DB schema: `DATABASE.md`
- Backend architecture: `BACKEND.md`

## Stack

- Next.js 16 (App Router, `proxy.ts` middleware)
- Neon Postgres + Drizzle ORM
- Tailwind v4 + custom Claude theme
- Resend (email giao hàng)
- Deploy: Vercel

## Setup

### 1. Install

```bash
pnpm install   # hoặc npm i
```

### 2. Tạo Neon database & set env

Copy `.env.example` sang `.env` và điền:

```bash
cp .env.example .env
```

Generate các key còn thiếu:

```bash
# ADMIN_JWT_SECRET
openssl rand -base64 32

# STOCK_ENCRYPTION_KEY (AES-256, 32 byte)
openssl rand -base64 32

# ADMIN_PASSWORD_HASH
node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD_HERE', 10))"
```

### 3. Tạo schema + seed

```bash
pnpm db:push      # đẩy schema lên Neon (dev)
pnpm db:seed      # tạo 3 sản phẩm mặc định
```

### 4. Chạy dev

```bash
pnpm dev
```

- Public: http://localhost:3000
- Admin login: http://localhost:3000/admin/login

## Flow chuẩn

1. Admin đăng nhập → `/admin/stock` → nạp credential theo sản phẩm.
2. Khách vào trang chủ → chọn sản phẩm → `/checkout` → nhập email → tạo đơn.
3. Đơn ở trạng thái `pending` + hiển thị QR VietQR cho khách chuyển khoản.
4. Khách chuyển khoản → admin kiểm tra bank → bấm **Xác nhận đã thanh toán** ở `/admin/orders/[id]`.
5. Hệ thống auto pick 1 credential `available` (FOR UPDATE SKIP LOCKED) → gửi email + đặt `warranty_until`.
6. Khách tra cứu đơn tại `/orders/[code]?email=...` để xem credential + yêu cầu bảo hành nếu cần.
7. Admin xử lý bảo hành ở `/admin/warranty` → bấm "Đổi account mới".

## Lưu ý

- Tất cả credential trong DB được mã hoá AES-256-GCM — mất DB không lộ credential.
- Middleware JWT bảo vệ toàn bộ `/admin/*` và `/api/admin/*`.
- Rate limit in-memory (reset khi restart) cho: login, checkout, lookup. Upgrade sang Upstash sau.
- Không có webhook bank tự động — admin vẫn xác nhận thủ công (MVP).

## Deploy

Push lên Git + import vào Vercel + set env vars + chạy `db:push` 1 lần từ local.
