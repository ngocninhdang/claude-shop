import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  accountStock,
  orderItems,
  orders,
  products,
  warrantyClaims,
  type WarrantyClaim,
} from '../db/schema'
import { decryptCredential } from '../crypto'

export class WarrantyError extends Error {
  code:
    | 'ORDER_NOT_FOUND'
    | 'EMAIL_MISMATCH'
    | 'ITEM_NOT_FOUND'
    | 'EXPIRED'
    | 'ALREADY_OPEN'
    | 'OUT_OF_STOCK'
    | 'INVALID_STATE'
  constructor(code: WarrantyError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export async function openClaim(input: {
  orderCode: string
  email: string
  orderItemId: string
  reason: string
}): Promise<WarrantyClaim> {
  const [order] = await db.select().from(orders).where(eq(orders.orderCode, input.orderCode)).limit(1)
  if (!order) throw new WarrantyError('ORDER_NOT_FOUND', 'Đơn không tồn tại')
  if (order.customerEmail.toLowerCase() !== input.email.toLowerCase().trim()) {
    throw new WarrantyError('EMAIL_MISMATCH', 'Email không khớp')
  }
  if (!order.warrantyUntil || order.warrantyUntil < new Date()) {
    throw new WarrantyError('EXPIRED', 'Đơn đã hết hạn bảo hành')
  }

  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, order.id)))
    .limit(1)
  if (!item) throw new WarrantyError('ITEM_NOT_FOUND', 'Line item không thuộc đơn này')

  const existing = await db
    .select({ id: warrantyClaims.id })
    .from(warrantyClaims)
    .where(and(eq(warrantyClaims.orderItemId, item.id), eq(warrantyClaims.status, 'open')))
    .limit(1)
  if (existing.length) throw new WarrantyError('ALREADY_OPEN', 'Đã có yêu cầu bảo hành đang mở')

  const [claim] = await db
    .insert(warrantyClaims)
    .values({
      orderItemId: item.id,
      reason: input.reason,
      status: 'open',
      oldStockId: item.deliveredStockId,
    })
    .returning()
  return claim
}

export async function listClaims(status?: WarrantyClaim['status']) {
  const where = status ? eq(warrantyClaims.status, status) : undefined
  return db
    .select({
      claim: warrantyClaims,
      item: orderItems,
      order: orders,
      product: products,
    })
    .from(warrantyClaims)
    .innerJoin(orderItems, eq(orderItems.id, warrantyClaims.orderItemId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(where)
    .orderBy(desc(warrantyClaims.createdAt))
}

export async function resolveClaim(claimId: string): Promise<{ newCredential: string }> {
  return await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(warrantyClaims)
      .where(eq(warrantyClaims.id, claimId))
      .for('update')
      .limit(1)
    if (!claim) throw new WarrantyError('ITEM_NOT_FOUND', 'Không tìm thấy claim')
    if (claim.status !== 'open') throw new WarrantyError('INVALID_STATE', 'Claim đã xử lý')

    const [item] = await tx
      .select({ item: orderItems, product: products })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.id, claim.orderItemId))
      .limit(1)
    if (!item) throw new WarrantyError('ITEM_NOT_FOUND', 'Không tìm thấy item')

    const picked = await tx.execute<{ id: string; credential: string }>(sql`
      SELECT id, credential FROM ${accountStock}
      WHERE product_id = ${item.product.id} AND status = 'available'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `)
    const newStock = picked.rows[0]
    if (!newStock) throw new WarrantyError('OUT_OF_STOCK', 'Hết hàng để đổi bảo hành')

    await tx
      .update(accountStock)
      .set({ status: 'sold', soldAt: new Date(), soldOrderId: item.item.orderId })
      .where(eq(accountStock.id, newStock.id))

    if (claim.oldStockId) {
      await tx
        .update(accountStock)
        .set({ status: 'disabled' })
        .where(eq(accountStock.id, claim.oldStockId))
    }

    await tx
      .update(orderItems)
      .set({ deliveredStockId: newStock.id })
      .where(eq(orderItems.id, item.item.id))

    await tx
      .update(warrantyClaims)
      .set({ status: 'resolved', newStockId: newStock.id, resolvedAt: new Date() })
      .where(eq(warrantyClaims.id, claimId))

    return { newCredential: decryptCredential(newStock.credential) }
  })
}

export async function rejectClaim(claimId: string, note?: string) {
  await db
    .update(warrantyClaims)
    .set({ status: 'rejected', adminNote: note || null, resolvedAt: new Date() })
    .where(eq(warrantyClaims.id, claimId))
}
