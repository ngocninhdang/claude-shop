import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  cancelOrder,
  getOrderById,
  markPaidAndDeliver,
  OrderServiceError,
} from '@/lib/services/order-service'
import { sendDelivery } from '@/lib/services/email-service'
import { formatDate, formatVnd } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function confirmAction(formData: FormData) {
  'use server'
  const orderId = String(formData.get('orderId'))
  try {
    const { delivered, order } = await markPaidAndDeliver(orderId)
    await sendDelivery({
      to: order.customerEmail,
      orderCode: order.orderCode,
      items: delivered.map((d) => ({ productName: d.productName, credential: d.credential })),
    })
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/admin/orders')
  } catch (e) {
    if (e instanceof OrderServiceError) {
      redirect(`/admin/orders/${orderId}?error=${encodeURIComponent(e.message)}`)
    }
    throw e
  }
}

async function cancelAction(formData: FormData) {
  'use server'
  const orderId = String(formData.get('orderId'))
  await cancelOrder(orderId)
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const order = await getOrderById(id)
  if (!order) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Đơn {order.orderCode}</h1>
        <p className="text-olive">
          Trạng thái: <Badge tone="info">{order.status}</Badge> · Tạo {formatDate(order.createdAt)}
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-[#f4d9d9] px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      <section className="rounded-xl bg-ivory p-6 ring-shadow">
        <h2 className="mb-3 font-serif text-xl">Khách hàng</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-olive">Email</dt>
          <dd>{order.customerEmail}</dd>
          <dt className="text-olive">Điện thoại</dt>
          <dd>{order.customerPhone ?? '—'}</dd>
          <dt className="text-olive">Ghi chú</dt>
          <dd>{order.customerNote ?? '—'}</dd>
          <dt className="text-olive">Tổng</dt>
          <dd className="font-medium">{formatVnd(order.totalVnd)}</dd>
          <dt className="text-olive">Bảo hành đến</dt>
          <dd>{formatDate(order.warrantyUntil)}</dd>
        </dl>
      </section>

      <section className="rounded-xl bg-ivory p-6 ring-shadow">
        <h2 className="mb-3 font-serif text-xl">Sản phẩm</h2>
        <ul className="space-y-3">
          {order.items.map((it) => (
            <li key={it.id} className="rounded-md bg-parchment p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{it.productNameSnapshot}</span>
                <span>{formatVnd(it.unitPriceVnd)}</span>
              </div>
              <div className="mt-1 text-olive">
                Credential:{' '}
                {it.credential ? (
                  <code className="rounded bg-sand px-2 py-0.5 font-mono text-charcoal">
                    {it.credential}
                  </code>
                ) : (
                  <span className="italic">Chưa giao</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {order.status === 'pending' || order.status === 'paid' ? (
        <div className="flex gap-3">
          <form action={confirmAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <Button type="submit">Xác nhận đã thanh toán → Giao</Button>
          </form>
          <form action={cancelAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <Button type="submit" variant="ghost">
              Huỷ đơn
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
