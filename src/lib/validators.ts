import { z } from 'zod'

export const CreateOrderSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  phone: z
    .string()
    .regex(/^[0-9+\-\s]{8,15}$/, 'SĐT không hợp lệ')
    .optional()
    .or(z.literal('')),
  note: z.string().max(500).optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1, 'Chưa chọn sản phẩm'),
})
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

export const OrderLookupSchema = z.object({
  orderCode: z.string().regex(/^CLS-[A-Z0-9]{6}$/, 'Mã đơn không hợp lệ'),
  email: z.string().email(),
})
export type OrderLookupInput = z.infer<typeof OrderLookupSchema>

export const WarrantyClaimSchema = z.object({
  orderCode: z.string().regex(/^CLS-[A-Z0-9]{6}$/),
  email: z.string().email(),
  orderItemId: z.string().uuid(),
  reason: z.string().min(10, 'Mô tả ít nhất 10 ký tự').max(1000),
})
export type WarrantyClaimInput = z.infer<typeof WarrantyClaimSchema>

export const AdminLoginSchema = z.object({
  password: z.string().min(1),
})

export const CreateProductSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'slug: chữ thường, số, gạch ngang'),
  name: z.string().min(2),
  description: z.string().optional().or(z.literal('')),
  priceVnd: z.number().int().min(0),
  productType: z.enum(['credential', 'giftcode']),
  warrantyDays: z.number().int().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const UpdateProductSchema = CreateProductSchema.partial()

export const AddStockSchema = z.object({
  productId: z.string().uuid(),
  credentials: z.array(z.string().min(1)).min(1),
  note: z.string().optional().or(z.literal('')),
})
