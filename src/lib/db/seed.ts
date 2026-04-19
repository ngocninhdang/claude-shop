import '../../../scripts/load-env'
import { db } from './index'
import { products } from './schema'

async function seed() {
  console.log('Seeding products…')
  await db
    .insert(products)
    .values([
      {
        slug: 'claude-x5',
        name: 'Claude x5 — Bảo hành full',
        description:
          'Tài khoản Claude giới hạn x5 usage. Bảo hành full trong 30 ngày — lỗi là đổi.',
        priceVnd: 2_300_000,
        productType: 'credential',
        warrantyDays: 30,
        sortOrder: 10,
      },
      {
        slug: 'claude-20x',
        name: 'Claude 20x — Giftcode',
        description:
          'Dạng giftcode 20x. Giao mã ngay sau khi thanh toán, không bảo hành.',
        priceVnd: 2_500_000,
        productType: 'giftcode',
        warrantyDays: 0,
        sortOrder: 20,
      },
      {
        slug: 'claude-pro-team',
        name: 'Claude Pro — Add Team',
        description:
          'Claude Pro thông qua add team. Bảo hành full trong suốt 30 ngày.',
        priceVnd: 370_000,
        productType: 'credential',
        warrantyDays: 30,
        sortOrder: 30,
      },
    ])
    .onConflictDoNothing({ target: products.slug })

  console.log('Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
