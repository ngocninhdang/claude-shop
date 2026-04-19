import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  accountStock,
  orderItems,
  orders,
  products,
  type Order,
  type OrderItem,
  type Product,
} from '../db/schema'
import { decryptCredential } from '../crypto'
import { generateOrderCode } from '../utils'

export type CreateOrderInput = {
  email: string
  phone?: string
  note?: string
  items: { productId: string; quantity: number }[]
}

export type OrderWithItems = Order & {
  items: (OrderItem & {
    product: Product
    credential?: string | null
  })[]
}

export class OrderServiceError extends Error {
  code: 'NOT_FOUND' | 'OUT_OF_STOCK' | 'INVALID_STATE' | 'EMAIL_MISMATCH'
  constructor(code: OrderServiceError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export async function createOrder(input: CreateOrderInput): Promise<{
  orderCode: string
  totalVnd: number
  orderId: string
}> {
  const productIds = input.items.map((i) => i.productId)
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true)))
  const productMap = new Map(rows.map((p) => [p.id, p]))

  let total = 0
  for (const item of input.items) {
    const p = productMap.get(item.productId)
    if (!p) throw new OrderServiceError('NOT_FOUND', `Sản phẩm không tồn tại: ${item.productId}`)
    total += p.priceVnd * item.quantity
  }

  return await db.transaction(async (tx) => {
    let orderCode = generateOrderCode()
    for (let i = 0; i < 3; i++) {
      const dupe = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.orderCode, orderCode))
        .limit(1)
      if (!dupe.length) break
      orderCode = generateOrderCode()
    }

    const [order] = await tx
      .insert(orders)
      .values({
        orderCode,
        customerEmail: input.email.toLowerCase().trim(),
        customerPhone: input.phone || null,
        customerNote: input.note || null,
        totalVnd: total,
        status: 'pending',
      })
      .returning()

    const itemRows = input.items.flatMap((it) => {
      const p = productMap.get(it.productId)!
      return Array.from({ length: it.quantity }, () => ({
        orderId: order.id,
        productId: p.id,
        productNameSnapshot: p.name,
        unitPriceVnd: p.priceVnd,
        quantity: 1,
      }))
    })
    await tx.insert(orderItems).values(itemRows)

    return { orderCode, totalVnd: total, orderId: order.id }
  })
}

export async function markPaidAndDeliver(orderId: string): Promise<{
  delivered: { orderItemId: string; productName: string; credential: string }[]
  order: Order
}> {
  return await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for('update')
      .limit(1)
    if (!order) throw new OrderServiceError('NOT_FOUND', 'Đơn không tồn tại')
    if (order.status === 'delivered') {
      throw new OrderServiceError('INVALID_STATE', 'Đơn đã được giao')
    }
    if (order.status !== 'pending' && order.status !== 'paid') {
      throw new OrderServiceError('INVALID_STATE', `Trạng thái không hợp lệ: ${order.status}`)
    }

    const items = await tx
      .select({
        item: orderItems,
        product: products,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, orderId))

    const delivered: { orderItemId: string; productName: string; credential: string }[] = []
    let maxWarrantyDays = 0

    for (const { item, product } of items) {
      if (item.deliveredStockId) {
        const [s] = await tx
          .select()
          .from(accountStock)
          .where(eq(accountStock.id, item.deliveredStockId))
          .limit(1)
        if (s) {
          delivered.push({
            orderItemId: item.id,
            productName: item.productNameSnapshot,
            credential: decryptCredential(s.credential),
          })
        }
        if (product.warrantyDays > maxWarrantyDays) maxWarrantyDays = product.warrantyDays
        continue
      }

      const picked = await tx.execute<{ id: string; credential: string }>(sql`
        SELECT id, credential
        FROM ${accountStock}
        WHERE product_id = ${product.id}
          AND status = 'available'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `)
      const stockRow = picked.rows[0]
      if (!stockRow) {
        throw new OrderServiceError(
          'OUT_OF_STOCK',
          `Hết hàng SKU: ${product.name}. Bổ sung kho rồi thử lại.`,
        )
      }

      await tx
        .update(accountStock)
        .set({ status: 'sold', soldAt: new Date(), soldOrderId: orderId })
        .where(eq(accountStock.id, stockRow.id))

      await tx
        .update(orderItems)
        .set({ deliveredStockId: stockRow.id })
        .where(eq(orderItems.id, item.id))

      delivered.push({
        orderItemId: item.id,
        productName: item.productNameSnapshot,
        credential: decryptCredential(stockRow.credential),
      })
      if (product.warrantyDays > maxWarrantyDays) maxWarrantyDays = product.warrantyDays
    }

    const now = new Date()
    const warrantyUntil =
      maxWarrantyDays > 0
        ? new Date(now.getTime() + maxWarrantyDays * 24 * 60 * 60 * 1000)
        : null

    const [updated] = await tx
      .update(orders)
      .set({
        status: 'delivered',
        paidAt: order.paidAt ?? now,
        deliveredAt: now,
        warrantyUntil,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .returning()

    return { delivered, order: updated }
  })
}

export async function cancelOrder(orderId: string): Promise<void> {
  await db
    .update(orders)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
}

export async function lookupByCode(
  orderCode: string,
  email: string,
): Promise<OrderWithItems | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderCode, orderCode))
    .limit(1)
  if (!order) return null
  if (order.customerEmail.toLowerCase() !== email.toLowerCase().trim()) {
    throw new OrderServiceError('EMAIL_MISMATCH', 'Email không khớp với đơn hàng')
  }

  const rows = await db
    .select({
      item: orderItems,
      product: products,
      stockCred: accountStock.credential,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(accountStock, eq(accountStock.id, orderItems.deliveredStockId))
    .where(eq(orderItems.orderId, order.id))

  return {
    ...order,
    items: rows.map((r) => ({
      ...r.item,
      product: r.product,
      credential:
        r.stockCred && order.status === 'delivered' ? decryptCredential(r.stockCred) : null,
    })),
  }
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return null
  const rows = await db
    .select({ item: orderItems, product: products, stockCred: accountStock.credential })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(accountStock, eq(accountStock.id, orderItems.deliveredStockId))
    .where(eq(orderItems.orderId, id))
  return {
    ...order,
    items: rows.map((r) => ({
      ...r.item,
      product: r.product,
      credential:
        r.stockCred && order.status === 'delivered' ? decryptCredential(r.stockCred) : null,
    })),
  }
}

export async function listOrders(filter: {
  status?: Order['status']
  page?: number
  pageSize?: number
}): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, filter.pageSize ?? 25))
  const offset = (page - 1) * pageSize

  const where = filter.status ? eq(orders.status, filter.status) : undefined

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(where),
  ])

  return { items, total: totalRows[0]?.n ?? 0, page, pageSize }
}
