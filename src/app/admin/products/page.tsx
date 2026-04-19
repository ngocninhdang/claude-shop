import { revalidatePath } from 'next/cache'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProduct, listAllProducts, updateProduct } from '@/lib/services/product-service'
import { CreateProductSchema, UpdateProductSchema } from '@/lib/validators'
import { formatVnd } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function createAction(formData: FormData) {
  'use server'
  const parsed = CreateProductSchema.parse({
    slug: String(formData.get('slug')),
    name: String(formData.get('name')),
    description: String(formData.get('description') ?? ''),
    priceVnd: Number(formData.get('priceVnd')),
    productType: String(formData.get('productType')) as 'credential' | 'giftcode',
    warrantyDays: Number(formData.get('warrantyDays') ?? 0),
    isActive: formData.get('isActive') === 'on',
    sortOrder: Number(formData.get('sortOrder') ?? 0),
  })
  await createProduct({
    ...parsed,
    description: parsed.description || null,
  })
  revalidatePath('/admin/products')
  revalidatePath('/')
}

async function toggleAction(formData: FormData) {
  'use server'
  const id = String(formData.get('id'))
  const isActive = formData.get('isActive') === 'true'
  await updateProduct(id, { isActive: !isActive })
  revalidatePath('/admin/products')
  revalidatePath('/')
}

async function updateAction(formData: FormData) {
  'use server'
  const id = String(formData.get('id'))
  const patch = UpdateProductSchema.parse({
    name: String(formData.get('name')),
    priceVnd: Number(formData.get('priceVnd')),
    warrantyDays: Number(formData.get('warrantyDays')),
  })
  await updateProduct(id, patch)
  revalidatePath('/admin/products')
  revalidatePath('/')
}

export default async function AdminProductsPage() {
  const products = await listAllProducts()
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">Sản phẩm</h1>

      <section className="rounded-xl bg-ivory p-6 ring-shadow">
        <h2 className="mb-4 font-serif text-xl">Thêm mới</h2>
        <form action={createAction} className="grid grid-cols-2 gap-4">
          <Input name="slug" placeholder="slug-url-friendly" required />
          <Input name="name" placeholder="Tên hiển thị" required />
          <Input
            name="priceVnd"
            type="number"
            min={0}
            step={1000}
            placeholder="Giá (VND)"
            required
          />
          <select
            name="productType"
            required
            className="w-full rounded-md bg-white px-3 py-2 text-sm ring-shadow"
          >
            <option value="credential">credential</option>
            <option value="giftcode">giftcode</option>
          </select>
          <Input name="warrantyDays" type="number" min={0} defaultValue={0} placeholder="Bảo hành (ngày)" />
          <Input name="sortOrder" type="number" defaultValue={0} placeholder="Thứ tự hiển thị" />
          <Input name="description" placeholder="Mô tả ngắn" className="col-span-2" />
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" name="isActive" defaultChecked />
            Bật hiển thị
          </label>
          <div className="col-span-2">
            <Button type="submit">Tạo sản phẩm</Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl bg-ivory p-4 ring-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-olive">
                  /{p.slug} · {p.productType} · bảo hành {p.warrantyDays}d
                </div>
              </div>
              <Badge tone={p.isActive ? 'success' : 'neutral'}>
                {p.isActive ? 'ACTIVE' : 'HIDDEN'}
              </Badge>
            </div>
            <form action={updateAction} className="mt-3 grid grid-cols-4 gap-2">
              <input type="hidden" name="id" value={p.id} />
              <Input name="name" defaultValue={p.name} />
              <Input name="priceVnd" type="number" defaultValue={p.priceVnd} />
              <Input name="warrantyDays" type="number" defaultValue={p.warrantyDays} />
              <Button type="submit" variant="secondary">
                Lưu
              </Button>
            </form>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-olive">Giá hiện tại: {formatVnd(p.priceVnd)}</span>
              <form action={toggleAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="isActive" value={String(p.isActive)} />
                <Button type="submit" variant="ghost">
                  {p.isActive ? 'Ẩn' : 'Hiện'}
                </Button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
