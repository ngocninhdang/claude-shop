import { redirect } from 'next/navigation'
import { SiteFooter, SiteHeader } from '@/components/shop/site-header'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'

async function lookupAction(formData: FormData) {
  'use server'
  const orderCode = String(formData.get('orderCode') ?? '').trim().toUpperCase()
  const email = String(formData.get('email') ?? '').trim()
  if (!orderCode || !email) return
  redirect(`/orders/${orderCode}?email=${encodeURIComponent(email)}`)
}

export default function OrderLookupIndex() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-4xl">Tra cứu đơn</h1>
        <p className="mt-2 text-olive">Nhập mã đơn và email để xem trạng thái / credential.</p>

        <form action={lookupAction} className="mt-6 space-y-4 rounded-2xl bg-ivory p-6 ring-shadow">
          <div>
            <label className="mb-1 block text-sm text-charcoal">Mã đơn</label>
            <Input name="orderCode" placeholder="CLS-XXXXXX" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal">Email</label>
            <Input name="email" type="email" required />
          </div>
          <SubmitButton className="w-full" pendingLabel="Đang tra cứu…">Tra cứu</SubmitButton>
        </form>
      </main>
      <SiteFooter />
    </>
  )
}
