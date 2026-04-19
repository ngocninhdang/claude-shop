import { revalidatePath } from 'next/cache'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { addStockBulk, countAvailable, disableStock, listStock } from '@/lib/services/stock-service'
import { listAllProducts } from '@/lib/services/product-service'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function addAction(formData: FormData) {
  'use server'
  const productId = String(formData.get('productId'))
  const raw = String(formData.get('credentials') ?? '')
  const note = String(formData.get('note') ?? '')
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  if (!productId || !lines.length) return
  await addStockBulk(productId, lines, note)
  revalidatePath('/admin/stock')
}

async function disableAction(formData: FormData) {
  'use server'
  await disableStock(String(formData.get('id')))
  revalidatePath('/admin/stock')
}

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const { product } = await searchParams
  const [products, stock] = await Promise.all([listAllProducts(), listStock(product)])
  const counts = await Promise.all(
    products.map(async (p) => [p.id, await countAvailable(p.id)] as const),
  )
  const countMap = Object.fromEntries(counts)

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Kho credential</h1>

      <section className="rounded-xl bg-ivory p-6 ring-shadow">
        <h2 className="mb-4 font-serif text-xl">Nạp kho</h2>
        <form action={addAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-charcoal">Sản phẩm</label>
            <select
              name="productId"
              required
              className="w-full rounded-md bg-white px-3 py-2 text-sm ring-shadow focus:ring-2 focus:ring-focus"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (còn {countMap[p.id] ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal">
              Credential / Giftcode (mỗi dòng 1)
            </label>
            <Textarea
              name="credentials"
              rows={6}
              placeholder={'email1:pass1\nemail2:pass2\n...'}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal">Ghi chú</label>
            <Input name="note" placeholder="Ghi chú nội bộ (tuỳ chọn)" />
          </div>
          <Button type="submit">Thêm vào kho</Button>
        </form>
      </section>

      <section className="rounded-xl bg-ivory p-6 ring-shadow">
        <h2 className="mb-4 font-serif text-xl">Danh sách ({stock.length})</h2>
        <table className="w-full text-sm">
          <thead className="bg-sand text-charcoal">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ID</th>
              <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
              <th className="px-3 py-2 text-left font-medium">Ghi chú</th>
              <th className="px-3 py-2 text-left font-medium">Tạo</th>
              <th className="px-3 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.id} className="border-t border-border-cream">
                <td className="px-3 py-2 font-mono text-xs">{s.id.slice(0, 8)}</td>
                <td className="px-3 py-2">
                  <Badge
                    tone={
                      s.status === 'available'
                        ? 'success'
                        : s.status === 'sold'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {s.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-olive">{s.note ?? '—'}</td>
                <td className="px-3 py-2 text-olive">{formatDate(s.createdAt)}</td>
                <td className="px-3 py-2 text-right">
                  {s.status === 'available' ? (
                    <form action={disableAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <Button type="submit" variant="ghost">
                        Disable
                      </Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
