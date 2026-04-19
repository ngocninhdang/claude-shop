import Link from 'next/link'
import { headers } from 'next/headers'
import { SiteFooter, SiteHeader } from '@/components/shop/site-header'
import { Badge } from '@/components/ui/badge'
import { lookupByCode } from '@/lib/services/order-service'
import { formatDate, formatVnd, qrUrl } from '@/lib/utils'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ email?: string; new?: string }>
}) {
  const { code } = await params
  const { email, new: isNew } = await searchParams
  const ip = getClientIp(await headers())
  if (!rateLimit(`order-lookup:${ip}`, 20, 60 * 1000)) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-16 text-center text-error">
          Quá nhiều lượt tra cứu. Chờ 1 phút rồi thử lại.
        </main>
      </>
    )
  }

  if (!email) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-16 text-center">
          <p>Thiếu email. <Link href="/orders" className="text-terracotta">Tra cứu lại</Link>.</p>
        </main>
      </>
    )
  }

  const order = await lookupByCode(code, email)
  if (!order) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-16 text-center">
          <p className="text-olive">Không tìm thấy đơn. Kiểm tra lại mã đơn và email.</p>
          <Link href="/orders" className="mt-4 inline-block text-terracotta hover:underline">
            ← Tra cứu lại
          </Link>
        </main>
      </>
    )
  }

  const qrImg = qrUrl(order.totalVnd, order.orderCode)
  const bankName = process.env.BANK_ACCOUNT_NAME
  const bankNo = process.env.BANK_ACCOUNT_NO
  const bankCode = process.env.BANK_BIN

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-4xl">Đơn {order.orderCode}</h1>
          <Badge
            tone={
              order.status === 'delivered'
                ? 'success'
                : order.status === 'pending'
                  ? 'warning'
                  : 'neutral'
            }
          >
            {order.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-olive">Tạo {formatDate(order.createdAt)}</p>

        {isNew && order.status === 'pending' ? (
          <div className="mt-6 rounded-md bg-[#f5e6cc] p-4 text-sm text-[#7a5a17]">
            ✓ Đã tạo đơn. Quét QR dưới đây để chuyển khoản. Admin sẽ giao hàng sau khi nhận tiền.
          </div>
        ) : null}

        {order.status === 'pending' ? (
          <section className="mt-6 rounded-2xl bg-ivory p-6 ring-shadow">
            <h2 className="font-serif text-2xl">Chuyển khoản</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="flex items-center justify-center rounded-md bg-white p-3 ring-shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImg} alt="QR chuyển khoản" className="h-64 w-64 object-contain" />
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Ngân hàng" value={bankCode ?? '—'} />
                <Row label="Số tài khoản" value={bankNo ?? '—'} copy />
                <Row label="Chủ tài khoản" value={bankName ?? '—'} />
                <Row label="Số tiền" value={formatVnd(order.totalVnd)} strong copy={String(order.totalVnd)} />
                <Row label="Nội dung" value={order.orderCode} strong copy />
                <p className="pt-3 text-xs text-olive">
                  Ghi đúng nội dung <b>{order.orderCode}</b> để hệ thống đối soát.
                </p>
              </dl>
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl bg-ivory p-6 ring-shadow">
          <h2 className="font-serif text-2xl">Sản phẩm</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((it) => (
              <li key={it.id} className="rounded-md bg-parchment p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{it.productNameSnapshot}</span>
                  <span>{formatVnd(it.unitPriceVnd)}</span>
                </div>
                <div className="mt-2">
                  {it.credential ? (
                    <>
                      <div className="text-xs text-olive">Credential</div>
                      <code className="mt-1 block break-all rounded bg-sand px-3 py-2 font-mono text-charcoal">
                        {it.credential}
                      </code>
                      {order.warrantyUntil && order.warrantyUntil > new Date() ? (
                        <Link
                          href={`/warranty/${order.orderCode}?email=${encodeURIComponent(email)}&item=${it.id}`}
                          className="mt-2 inline-block text-sm text-terracotta hover:underline"
                        >
                          Yêu cầu bảo hành →
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <span className="italic text-olive">Chờ giao…</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-border-warm pt-4 font-medium">
            <span>Tổng</span>
            <span>{formatVnd(order.totalVnd)}</span>
          </div>
          {order.warrantyUntil ? (
            <p className="mt-2 text-sm text-olive">
              Bảo hành đến: <b>{formatDate(order.warrantyUntil)}</b>
            </p>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function Row({
  label,
  value,
  strong,
  copy,
}: {
  label: string
  value: string
  strong?: boolean
  copy?: string | boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-olive">{label}</dt>
      <dd className={strong ? 'font-semibold' : ''}>
        {copy ? (
          <span className="select-all font-mono">{value}</span>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
