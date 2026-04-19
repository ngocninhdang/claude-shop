import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const productTypeEnum = pgEnum('product_type', ['credential', 'giftcode'])
export const stockStatusEnum = pgEnum('stock_status', ['available', 'reserved', 'sold', 'disabled'])
export const orderStatusEnum = pgEnum('order_status', ['pending', 'paid', 'delivered', 'cancelled', 'refunded'])
export const claimStatusEnum = pgEnum('claim_status', ['open', 'resolved', 'rejected'])

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  priceVnd: integer('price_vnd').notNull(),
  productType: productTypeEnum('product_type').notNull(),
  warrantyDays: integer('warranty_days').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const accountStock = pgTable(
  'account_stock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
    credential: text('credential').notNull(),
    status: stockStatusEnum('status').notNull().default('available'),
    note: text('note'),
    soldAt: timestamp('sold_at', { withTimezone: true }),
    soldOrderId: uuid('sold_order_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxAvailable: index('idx_stock_available')
      .on(t.productId, t.status)
      .where(sql`${t.status} = 'available'`),
    idxOrder: index('idx_stock_order').on(t.soldOrderId),
  }),
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderCode: text('order_code').notNull().unique(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone'),
    customerNote: text('customer_note'),
    totalVnd: integer('total_vnd').notNull(),
    status: orderStatusEnum('status').notNull().default('pending'),
    paymentMethod: text('payment_method').notNull().default('bank_transfer'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    warrantyUntil: timestamp('warranty_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxStatus: index('idx_orders_status').on(t.status, t.createdAt),
    idxEmail: index('idx_orders_email').on(t.customerEmail),
  }),
)

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productNameSnapshot: text('product_name_snapshot').notNull(),
  unitPriceVnd: integer('unit_price_vnd').notNull(),
  quantity: integer('quantity').notNull().default(1),
  deliveredStockId: uuid('delivered_stock_id').references(() => accountStock.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const warrantyClaims = pgTable('warranty_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: claimStatusEnum('status').notNull().default('open'),
  oldStockId: uuid('old_stock_id').references(() => accountStock.id, { onDelete: 'set null' }),
  newStockId: uuid('new_stock_id').references(() => accountStock.id, { onDelete: 'set null' }),
  adminNote: text('admin_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type AccountStock = typeof accountStock.$inferSelect
export type NewAccountStock = typeof accountStock.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
export type WarrantyClaim = typeof warrantyClaims.$inferSelect
export type NewWarrantyClaim = typeof warrantyClaims.$inferInsert
