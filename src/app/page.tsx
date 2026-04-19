import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/shop/site-header'
import { listActiveProducts } from '@/lib/services/product-service'
import { countAvailable } from '@/lib/services/stock-service'
import { formatVnd } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const products = await listActiveProducts()
  const stock = await Promise.all(
    products.map(async (p) => [p.id, await countAvailable(p.id)] as const),
  )
  const stockMap = Object.fromEntries(stock)

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6">
        <section className="py-16 md:py-24">
          <h1 className="font-serif text-5xl leading-tight md:text-6xl">
            Tài khoản Claude<br />
            <span className="text-terracotta">chính hãng, giao tự động.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-olive">
            Chọn gói, chuyển khoản qua QR, nhận credential trong email ngay khi admin xác nhận.
            Bảo hành rõ ràng — lỗi là đổi.
          </p>
        </section>

        <section className="grid gap-6 pb-16 md:grid-cols-3">
          {products.map((p) => {
            const available = stockMap[p.id] ?? 0
            return (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group flex flex-col rounded-2xl bg-ivory p-6 ring-shadow transition hover:ring-shadow-deep"
              >
                <h2 className="font-serif text-2xl leading-tight">{p.name}</h2>
                {p.description ? (
                  <p className="mt-3 line-clamp-3 text-sm text-olive">{p.description}</p>
                ) : null}
                <div className="mt-auto flex items-end justify-between pt-6">
                  <div>
                    <div className="font-serif text-3xl text-deep-dark">{formatVnd(p.priceVnd)}</div>
                    <div className="text-xs text-olive">
                      {p.warrantyDays > 0 ? `Bảo hành ${p.warrantyDays} ngày` : 'Không bảo hành'}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${available > 0 ? 'bg-[#e6efe0] text-[#3b5d2b]' : 'bg-sand text-olive'}`}
                  >
                    {available > 0 ? `Còn ${available}` : 'Hết hàng'}
                  </span>
                </div>
                <span className="mt-4 text-sm text-terracotta group-hover:underline">
                  Xem chi tiết →
                </span>
              </Link>
            )
          })}
        </section>

        <section className="grid gap-6 border-t border-border-warm py-12 md:grid-cols-3">
          <Feature title="Giao tự động" body="Nhận credential qua email ngay khi đơn được xác nhận." />
          <Feature title="Bảo hành minh bạch" body="Lỗi trong thời hạn — đổi account mới trong 1 nốt nhạc." />
          <Feature title="Thanh toán an toàn" body="Chuyển khoản QR VietQR, không cần tài khoản." />
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-serif text-xl">{title}</h3>
      <p className="mt-2 text-sm text-olive">{body}</p>
    </div>
  )
}
