import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { listClaims, rejectClaim, resolveClaim, WarrantyError } from '@/lib/services/warranty-service'
import { sendWarrantyResolved } from '@/lib/services/email-service'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function resolveAction(formData: FormData) {
  'use server'
  const claimId = String(formData.get('claimId'))
  const to = String(formData.get('email'))
  const orderCode = String(formData.get('orderCode'))
  const productName = String(formData.get('productName'))
  try {
    const { newCredential } = await resolveClaim(claimId)
    await sendWarrantyResolved({ to, orderCode, productName, newCredential })
  } catch (e) {
    if (e instanceof WarrantyError) {
      redirect(`/admin/warranty?error=${encodeURIComponent(e.message)}`)
    }
    throw e
  }
  revalidatePath('/admin/warranty')
}

async function rejectActionFn(formData: FormData) {
  'use server'
  await rejectClaim(String(formData.get('claimId')), String(formData.get('note') ?? ''))
  revalidatePath('/admin/warranty')
}

export default async function AdminWarrantyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>
}) {
  const { status, error } = await searchParams
  const list = await listClaims(
    status === 'open' || status === 'resolved' || status === 'rejected' ? status : undefined,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Bảo hành</h1>
        <div className="flex gap-2 text-sm">
          {(['all', 'open', 'resolved', 'rejected'] as const).map((s) => (
            <Link
              key={s}
              href={s === 'all' ? '/admin/warranty' : `/admin/warranty?status=${s}`}
              className={`rounded-full px-3 py-1 ${(status ?? 'all') === s ? 'bg-deep-dark text-ivory' : 'bg-sand text-charcoal'}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-[#f4d9d9] px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      <div className="space-y-3">
        {list.map(({ claim, item, order, product }) => (
          <div key={claim.id} className="rounded-xl bg-ivory p-5 ring-shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-mono text-terracotta hover:underline">
                    {order.orderCode}
                  </Link>
                  <Badge
                    tone={
                      claim.status === 'open'
                        ? 'warning'
                        : claim.status === 'resolved'
                          ? 'success'
                          : 'neutral'
                    }
                  >
                    {claim.status}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-olive">
                  {product.name} · {order.customerEmail} · {formatDate(claim.createdAt)}
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-md bg-parchment p-3 text-sm">
                  {claim.reason}
                </p>
                {claim.adminNote ? (
                  <p className="mt-2 text-sm text-olive">Ghi chú: {claim.adminNote}</p>
                ) : null}
              </div>

              {claim.status === 'open' ? (
                <div className="flex flex-col gap-2">
                  <form action={resolveAction}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="email" value={order.customerEmail} />
                    <input type="hidden" name="orderCode" value={order.orderCode} />
                    <input type="hidden" name="productName" value={item.productNameSnapshot} />
                    <SubmitButton pendingLabel="Đang đổi…">Đổi account mới</SubmitButton>
                  </form>
                  <form action={rejectActionFn} className="flex gap-2">
                    <input type="hidden" name="claimId" value={claim.id} />
                    <Input name="note" placeholder="Lý do từ chối" />
                    <SubmitButton variant="ghost" pendingLabel="…">
                      Từ chối
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {!list.length ? (
          <div className="rounded-xl bg-ivory p-12 text-center text-olive ring-shadow">
            Không có yêu cầu bảo hành.
          </div>
        ) : null}
      </div>
    </div>
  )
}
