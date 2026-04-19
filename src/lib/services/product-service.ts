import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db'
import { products, type NewProduct, type Product } from '../db/schema'

export async function listActiveProducts(): Promise<Product[]> {
  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.sortOrder), asc(products.createdAt))
}

export async function listAllProducts(): Promise<Product[]> {
  return db.select().from(products).orderBy(asc(products.sortOrder), asc(products.createdAt))
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1)
  return rows[0] ?? null
}

export async function getProductById(id: string): Promise<Product | null> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createProduct(input: NewProduct): Promise<Product> {
  const [row] = await db.insert(products).values(input).returning()
  return row
}

export async function updateProduct(id: string, patch: Partial<NewProduct>): Promise<Product> {
  const [row] = await db
    .update(products)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  return row
}
