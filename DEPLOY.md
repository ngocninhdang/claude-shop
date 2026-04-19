# Deployment — VPS + Docker + Caddy

Target: `claude.nguyentheduc.com` reverse-proxied qua Caddy đến Next.js trong Docker, Postgres ở Neon (không tự host).

## Kiến trúc

```
[Internet] → :80/:443
    Caddy (auto HTTPS via Let's Encrypt)
       └─ reverse_proxy → app:3000
           Next.js standalone (Docker)
              └─ Neon Postgres (external)
```

## 1. Chuẩn bị DNS

Trỏ A record:
```
claude.nguyentheduc.com  A  <VPS_IP>
```

Đợi propagate (check bằng `dig +short claude.nguyentheduc.com`) trước khi chạy bước 4 để Caddy xin được cert.

## 2. Chuẩn bị VPS

Ubuntu/Debian:
```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 3. Clone + config

```bash
cd /opt
sudo git clone https://github.com/ngocninhdang/claude-shop.git
sudo chown -R $USER:$USER claude-shop
cd claude-shop

# Tạo .env.production từ example
cp .env.production.example .env.production
```

Sinh credentials cho prod:
```bash
# Password admin (KHÔNG dùng admin123 ở prod)
node -e "console.log(require('bcryptjs').hashSync('YOUR_STRONG_PASSWORD',10))"

# Keys
openssl rand -base64 32   # ADMIN_JWT_SECRET
openssl rand -base64 32   # STOCK_ENCRYPTION_KEY
```

Điền vào `.env.production`. **Chú ý**: khi dán bcrypt hash, escape mỗi `$` thành `\$`:
```
ADMIN_PASSWORD_HASH=\$2a\$10\$xxxxxxxxxxxxxxxxxxxxxx
```

## 4. Chạy

Lần đầu:
```bash
docker compose up -d --build
docker compose logs -f caddy    # xem Caddy xin cert
docker compose logs -f app
```

Đợi 30–60s cho Caddy xin xong cert Let's Encrypt. Truy cập https://claude.nguyentheduc.com.

## 5. Migration & seed (chạy 1 lần từ máy local)

Vì schema đã ở Neon, chạy từ máy dev (không cần vào container):
```bash
# Máy local, .env trỏ vào DATABASE_URL production
npm run db:push
npm run db:seed
```

Hoặc chạy trong container:
```bash
docker compose exec app sh -c "cd /app && node ./scripts/db-push.js"   # (option khác: dùng psql)
```

## 6. Update khi có code mới

```bash
cd /opt/claude-shop
git pull
docker compose up -d --build
```

## 7. Logs & debug

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f caddy
docker compose restart app
```

## 8. Backup

Dữ liệu nằm ở Neon (có point-in-time restore sẵn). Không cần backup container.
Riêng cert Caddy lưu ở volume `caddy_data` — nếu cần reset thì `docker volume rm claude-shop_caddy_data`.

## 9. Rollback

```bash
git log --oneline | head -5
git checkout <previous-sha>
docker compose up -d --build
```

## Troubleshooting

| Triệu chứng | Xử lý |
|------------|-------|
| Caddy không xin được cert | Check DNS đã trỏ đúng IP + firewall mở 80/443 |
| App 500 "DATABASE_URL required" | `.env.production` chưa điền hoặc sai format |
| `Sai mật khẩu` khi login admin | Hash có `$` chưa escape thành `\$` |
| Build fail vì DATABASE_URL | Dockerfile đã inject placeholder khi build — nếu vẫn fail check lại Dockerfile `ENV` line |
