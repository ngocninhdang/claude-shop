import { Resend } from 'resend'
import OrderDeliveredEmail from '@/emails/order-delivered'
import WarrantyResolvedEmail from '@/emails/warranty-resolved'

function getClient() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = process.env.RESEND_FROM ?? 'Claude Shop <no-reply@example.com>'

export async function sendDelivery(params: {
  to: string
  orderCode: string
  items: { productName: string; credential: string }[]
}): Promise<void> {
  const resend = getClient()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set, skipping delivery email', params.orderCode)
    return
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Đơn ${params.orderCode} đã được giao`,
    react: OrderDeliveredEmail({ orderCode: params.orderCode, items: params.items }),
  })
}

export async function sendWarrantyResolved(params: {
  to: string
  orderCode: string
  productName: string
  newCredential: string
}): Promise<void> {
  const resend = getClient()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set, skipping warranty email', params.orderCode)
    return
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Đã xử lý bảo hành — Đơn ${params.orderCode}`,
    react: WarrantyResolvedEmail({
      orderCode: params.orderCode,
      productName: params.productName,
      newCredential: params.newCredential,
    }),
  })
}
