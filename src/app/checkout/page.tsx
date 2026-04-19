import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/shop/site-header'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { listActiveProducts, getProductBySlug } from '@/lib/services/product-service'
import { createOrder } from '@/lib/services/order-service'
import { formatVnd } from '@/lib/utils'
import { CreateOrderSchema } from '@/lib/validators'

export const dynamic = 'force-dynamic'

async function checkoutAction(formData: FormData) {
  'use server'
  const productId = String(formData.get('productId'))
  const quantity = Math.max(1, Math.min(10, Number(formData.get('quantity') ?? 1)))
  const email = String(formData.get('email') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  const parsed = CreateOrderSchema.parse({
    email,
    phone: phone || undefined,
    note: note || undefined,
    items: [{ productId, quantity }],
  })

  const { orderCode } = await createOrder(parsed)
  redirect(`/orders/${orderCode}?email=${encodeURIComponent(parsed.email)}&new=1`)
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const { product: slug } = await searchParams
  const products = await listActiveProducts()
  const preselected = slug ? await getProductBySlug(slug) : null
  const selectedId = preselected?.id ?? products[0]?.id

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-serif text-4xl">Thanh toán</h1>
        <p className="mt-2 text-olive">Điền thông tin, hệ thống sẽ tạo đơn và hiển thị QR chuyển khoản.</p>

        <form
          action={checkoutAction}
          className="mt-8 space-y-5 rounded-2xl bg-ivory p-8 ring-shadow"
        >
          <div>
            <label className="mb-1 block text-sm text-charcoal">Sản phẩm</label>
            <select
              name="productId"
              defaultValue={selectedId}
              required
              className="w-full rounded-md bg-white px-3 py-2 text-sm ring-shadow focus:ring-2 focus:ring-focus"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatVnd(p.priceVnd)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-charcoal">Số lượng</label>
              <Input name="quantity" type="number" min={1} max={10} defaultValue={1} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-charcoal">Điện thoại (tuỳ chọn)</label>
              <Input name="phone" placeholder="09xxxxxxxx" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-charcoal">Email nhận hàng *</label>
            <Input name="email" type="email" required placeholder="email@domain.com" />
            <p className="mt-1 text-xs text-olive">
              Credential sẽ gửi về email này và dùng để tra cứu đơn.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-charcoal">Ghi chú</label>
            <Textarea name="note" rows={3} placeholder="Tuỳ chọn" />
          </div>

          <Button type="submit" className="w-full">
            Tạo đơn & xem QR
          </Button>

          <p className="text-xs text-olive">
            Bấm "Tạo đơn" = đồng ý{' '}
            <Link href="#" className="underline">
              điều khoản
            </Link>
            .
          </p>
        </form>
      </main>
      <SiteFooter />
    </>
  )
}
