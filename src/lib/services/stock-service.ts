import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { accountStock, type AccountStock } from '../db/schema'
import { encryptCredential } from '../crypto'

export type StockStatus = AccountStock['status']

export async function listStock(productId?: string, status?: StockStatus) {
  const conds = []
  if (productId) conds.push(eq(accountStock.productId, productId))
  if (status) conds.push(eq(accountStock.status, status))
  return db
    .select()
    .from(accountStock)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(accountStock.createdAt))
    .limit(500)
}

export async function addStockBulk(
  productId: string,
  credentials: string[],
  note?: string,
): Promise<{ inserted: number }> {
  const rows = credentials
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => ({
      productId,
      credential: encryptCredential(c),
      note: note || null,
      status: 'available' as const,
    }))
  if (!rows.length) return { inserted: 0 }
  await db.insert(accountStock).values(rows)
  return { inserted: rows.length }
}

export async function disableStock(id: string) {
  await db
    .update(accountStock)
    .set({ status: 'disabled' })
    .where(eq(accountStock.id, id))
}

export async function countAvailable(productId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(accountStock)
    .where(and(eq(accountStock.productId, productId), eq(accountStock.status, 'available')))
  return row?.n ?? 0
}
