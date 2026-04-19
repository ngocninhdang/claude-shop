import type { Order } from '../db/schema'
import { formatVnd } from '../utils'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? ''

async function send(text: string): Promise<void> {
  if (!TOKEN || !CHAT_ID) {
    console.warn('[tg] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing; skip notify')
    return
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) console.warn('[tg] send failed', res.status, await res.text())
  } catch (e) {
    console.warn('[tg] send error', e)
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function notifyNewOrder(params: {
  order: Order
  items: { name: string; qty: number; price: number }[]
}): Promise<void> {
  const { order, items } = params
  const lines = [
    `🛒 <b>Đơn mới ${escape(order.orderCode)}</b>`,
    '',
    ...items.map((i) => `• ${escape(i.name)} × ${i.qty} — ${formatVnd(i.price * i.qty)}`),
    '',
    `💰 Tổng: <b>${formatVnd(order.totalVnd)}</b>`,
    `📧 ${escape(order.customerEmail)}`,
    ...(order.customerPhone ? [`📞 ${escape(order.customerPhone)}`] : []),
    ...(order.customerNote ? [`📝 ${escape(order.customerNote)}`] : []),
    '',
    `${SITE}/admin/orders/${order.id}`,
  ]
  await send(lines.join('\n'))
}

export async function notifyPaymentClaimed(order: Order): Promise<void> {
  await send(
    [
      `💸 <b>Khách báo đã chuyển khoản</b>`,
      ``,
      `Đơn: <code>${escape(order.orderCode)}</code>`,
      `Số tiền: <b>${formatVnd(order.totalVnd)}</b>`,
      `📧 ${escape(order.customerEmail)}`,
      ``,
      `➡️ Kiểm tra bank và xác nhận:`,
      `${SITE}/admin/orders/${order.id}`,
    ].join('\n'),
  )
}

export async function notifyNewWarranty(params: {
  orderCode: string
  productName: string
  customerEmail: string
  reason: string
}): Promise<void> {
  const lines = [
    `⚠️ <b>Yêu cầu bảo hành</b>`,
    ``,
    `Đơn: <code>${escape(params.orderCode)}</code>`,
    `SP: ${escape(params.productName)}`,
    `📧 ${escape(params.customerEmail)}`,
    ``,
    `<i>Lý do:</i>`,
    escape(params.reason).slice(0, 500),
    ``,
    `${SITE}/admin/warranty`,
  ]
  await send(lines.join('\n'))
}
