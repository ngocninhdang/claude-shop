import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/shop/site-header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { lookupByCode, OrderServiceError } from '@/lib/services/order-service'
import { openClaim, WarrantyError } from '@/lib/services/warranty-service'
import { WarrantyClaimSchema } from '@/lib/validators'

export const dynamic = 'force-dynamic'

async function submitAction(formData: FormData) {
  'use server'
  const parsed = WarrantyClaimSchema.parse({
    orderCode: String(formData.get('orderCode') ?? ''),
    email: String(formData.get('email') ?? ''),
    orderItemId: String(formData.get('orderItemId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
  })
  try {
    await openClaim(parsed)
  } catch (e) {
    if (e instanceof WarrantyError) {
      redirect(
        `/warranty/${parsed.orderCode}?email=${encodeURIComponent(parsed.email)}&item=${parsed.orderItemId}&error=${encodeURIComponent(e.message)}`,
      )
    }
    throw e
  }
  redirect(`/orders/${parsed.orderCode}?email=${encodeURIComponent(parsed.email)}&claim=ok`)
}

export default async function WarrantyPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ email?: string; item?: string; error?: string }>
}) {
  const { code } = await params
  const { email, item, error } = await searchParams
  if (!email || !item) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-16 text-center text-olive">
          Link không hợp lệ. <Link href="/orders" className="text-terracotta">Tra cứu đơn</Link>.
        </main>
      </>
    )
  }

  let order
  try {
    order = await lookupByCode(code, email)
  } catch (e) {
    if (e instanceof OrderServiceError) {
      return (
        <>
          <SiteHeader />
          <main className="mx-auto max-w-lg px-6 py-16 text-center text-error">{e.message}</main>
        </>
      )
    }
    throw e
  }
  if (!order) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-16 text-center text-olive">
          Đơn không tồn tại.
        </main>
      </>
    )
  }

  const orderItem = order.items.find((i) => i.id === item)
  if (!orderItem) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-16 text-center text-olive">
          Line item không thuộc đơn này.
        </main>
      </>
    )
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={`/orders/${code}?email=${encodeURIComponent(email)}`}
          className="text-sm text-olive hover:text-terracotta"
        >
          ← Về đơn hàng
        </Link>
        <h1 className="mt-4 font-serif text-3xl">Yêu cầu bảo hành</h1>
        <p className="mt-1 text-olive">
          Sản phẩm: <b>{orderItem.productNameSnapshot}</b> · Đơn {code}
        </p>

        {error ? (
          <div className="mt-4 rounded-md bg-[#f4d9d9] px-4 py-3 text-sm text-error">{error}</div>
        ) : null}

        <form action={submitAction} className="mt-6 space-y-4 rounded-2xl bg-ivory p-6 ring-shadow">
          <input type="hidden" name="orderCode" value={code} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="orderItemId" value={item} />
          <div>
            <label className="mb-1 block text-sm text-charcoal">Mô tả lỗi</label>
            <Textarea
              name="reason"
              rows={6}
              required
              minLength={10}
              placeholder="Nêu rõ lỗi bạn gặp: không login được, bị khoá, v.v."
            />
          </div>
          <Button type="submit">Gửi yêu cầu</Button>
        </form>
      </main>
      <SiteFooter />
    </>
  )
}
