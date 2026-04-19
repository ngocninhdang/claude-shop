import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { listOrders } from '@/lib/services/order-service'
import { formatDate, formatVnd } from '@/lib/utils'
import type { Order } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<Order['status'], 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  paid: 'info',
  delivered: 'success',
  cancelled: 'neutral',
  refunded: 'danger',
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const status = (params.status ?? undefined) as Order['status'] | undefined
  const page = Number(params.page ?? 1)
  const { items, total, pageSize } = await listOrders({ status, page })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Đơn hàng</h1>
        <div className="flex gap-2 text-sm">
          {(['all', 'pending', 'delivered', 'cancelled'] as const).map((s) => (
            <Link
              key={s}
              href={s === 'all' ? '/admin/orders' : `/admin/orders?status=${s}`}
              className={`rounded-full px-3 py-1 ${status === s || (s === 'all' && !status) ? 'bg-deep-dark text-ivory' : 'bg-sand text-charcoal hover:bg-border-warm'}`}
            >
              {s === 'all' ? 'Tất cả' : s}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-ivory ring-shadow">
        <table className="w-full text-sm">
          <thead className="bg-sand text-charcoal">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Mã</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-right font-medium">Tổng</th>
              <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-3 text-left font-medium">Tạo lúc</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t border-border-cream hover:bg-parchment">
                <td className="px-4 py-3 font-mono">
                  <Link href={`/admin/orders/${o.id}`} className="text-terracotta hover:underline">
                    {o.orderCode}
                  </Link>
                </td>
                <td className="px-4 py-3 text-charcoal">{o.customerEmail}</td>
                <td className="px-4 py-3 text-right">{formatVnd(o.totalVnd)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                </td>
                <td className="px-4 py-3 text-olive">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-olive">
                  Chưa có đơn nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm text-olive">
          <span>
            Trang {page}/{totalPages}
          </span>
        </div>
      ) : null}
    </div>
  )
}
