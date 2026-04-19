import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/shop/site-header'
import { getProductBySlug } from '@/lib/services/product-service'
import { countAvailable } from '@/lib/services/stock-service'
import { formatVnd } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()
  const available = await countAvailable(product.id)

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-olive hover:text-terracotta">
          ← Về danh sách
        </Link>

        <article className="mt-6 rounded-2xl bg-ivory p-10 ring-shadow">
          <h1 className="font-serif text-4xl leading-tight">{product.name}</h1>
          <div className="mt-2 text-sm text-olive">
            {product.productType === 'giftcode' ? 'Dạng giftcode' : 'Credential (email + mật khẩu)'}
            {' · '}
            {product.warrantyDays > 0 ? `Bảo hành ${product.warrantyDays} ngày` : 'Không bảo hành'}
          </div>

          {product.description ? (
            <p className="mt-6 whitespace-pre-wrap text-[17px] leading-relaxed text-charcoal">
              {product.description}
            </p>
          ) : null}

          <div className="mt-10 flex items-end justify-between border-t border-border-warm pt-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-olive">Giá</div>
              <div className="font-serif text-4xl text-deep-dark">{formatVnd(product.priceVnd)}</div>
            </div>
            <div className="text-right">
              <div
                className={`inline-block rounded-full px-3 py-1 text-xs ${available > 0 ? 'bg-[#e6efe0] text-[#3b5d2b]' : 'bg-sand text-olive'}`}
              >
                {available > 0 ? `Còn ${available} trong kho` : 'Tạm hết hàng'}
              </div>
            </div>
          </div>

          <form action="/checkout" method="get" className="mt-6">
            <input type="hidden" name="product" value={product.slug} />
            <button
              type="submit"
              disabled={available === 0}
              className="w-full rounded-md bg-terracotta px-4 py-3 text-center font-medium text-ivory transition hover:bg-coral disabled:opacity-50"
            >
              {available > 0 ? 'Mua ngay' : 'Hết hàng'}
            </button>
          </form>
        </article>

        <section className="mt-8 rounded-2xl bg-ivory p-6 ring-shadow">
          <h2 className="font-serif text-xl">Quy trình</h2>
          <ol className="mt-3 space-y-2 text-sm text-charcoal">
            <li>1. Nhập email, chuyển khoản qua QR.</li>
            <li>2. Admin xác nhận (thường trong vài phút giờ hành chính).</li>
            <li>3. Credential gửi đến email + hiển thị ngay trên trang tra cứu đơn.</li>
            {product.warrantyDays > 0 ? (
              <li>4. Gặp lỗi trong {product.warrantyDays} ngày? Gửi yêu cầu bảo hành — đổi mới ngay.</li>
            ) : null}
          </ol>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
