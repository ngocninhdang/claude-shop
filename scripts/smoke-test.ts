import './load-env'
import bcrypt from 'bcryptjs'
import { listActiveProducts } from '../src/lib/services/product-service'
import { addStockBulk, countAvailable } from '../src/lib/services/stock-service'
import {
  createOrder,
  lookupByCode,
  markPaidAndDeliver,
} from '../src/lib/services/order-service'
import { openClaim, resolveClaim } from '../src/lib/services/warranty-service'
import { encryptCredential, decryptCredential } from '../src/lib/crypto'

function log(label: string, ok: boolean, extra?: unknown) {
  const tag = ok ? '✓' : '✗'
  console.log(`${tag} ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  console.log('\n[1] Bcrypt password check')
  const ok = await bcrypt.compare('admin123', process.env.ADMIN_PASSWORD_HASH!)
  log('admin123 matches ADMIN_PASSWORD_HASH', ok)

  console.log('\n[2] Crypto roundtrip')
  const enc = encryptCredential('hello:world')
  const dec = decryptCredential(enc)
  log('encrypt/decrypt', dec === 'hello:world', { enc: enc.slice(0, 20) + '…' })

  console.log('\n[3] Products')
  const products = await listActiveProducts()
  log(`listActiveProducts returned ${products.length}`, products.length >= 3)
  const x5 = products.find((p) => p.slug === 'claude-x5')!
  log('found claude-x5', Boolean(x5))

  console.log('\n[4] Add stock')
  const added = await addStockBulk(x5.id, ['test1@x:pw1', 'test2@x:pw2'], 'smoke test')
  log('added 2 stock entries', added.inserted === 2, added)
  const avail = await countAvailable(x5.id)
  log('countAvailable >= 2', avail >= 2, { avail })

  console.log('\n[5] Create order')
  const { orderCode, totalVnd } = await createOrder({
    email: 'smoke@test.local',
    items: [{ productId: x5.id, quantity: 1 }],
  })
  log(`order created ${orderCode}`, orderCode.startsWith('CLS-'), { orderCode, totalVnd })

  console.log('\n[6] Lookup pending')
  const pending = await lookupByCode(orderCode, 'smoke@test.local')
  log('lookup returns pending order', pending?.status === 'pending', {
    status: pending?.status,
    items: pending?.items.length,
  })
  log(
    'credential hidden while pending',
    pending?.items.every((i) => i.credential === null),
  )

  console.log('\n[7] Mark paid + deliver')
  const { delivered, order: updated } = await markPaidAndDeliver(pending!.id)
  log('1 credential delivered', delivered.length === 1, {
    delivered: delivered[0]?.credential,
  })
  log('order status = delivered', updated.status === 'delivered')
  log('warranty_until set', !!updated.warrantyUntil)

  console.log('\n[8] Lookup delivered')
  const done = await lookupByCode(orderCode, 'smoke@test.local')
  log('credential exposed after delivery', !!done?.items[0]?.credential, {
    cred: done?.items[0]?.credential,
  })

  console.log('\n[9] Warranty flow')
  const claim = await openClaim({
    orderCode,
    email: 'smoke@test.local',
    orderItemId: done!.items[0].id,
    reason: 'Account bị khoá sau 1 ngày — test bảo hành',
  })
  log('claim opened', claim.status === 'open')

  // need at least 1 more stock to resolve
  const availBefore = await countAvailable(x5.id)
  if (availBefore < 1) {
    console.log('  (adding extra stock for warranty)')
    await addStockBulk(x5.id, ['warranty-backup:pw'], 'warranty')
  }
  const { newCredential } = await resolveClaim(claim.id)
  log('claim resolved with new cred', newCredential.length > 0, { newCredential })

  const afterWarranty = await lookupByCode(orderCode, 'smoke@test.local')
  log(
    'item credential swapped to new one',
    afterWarranty?.items[0]?.credential === newCredential,
  )

  console.log('\n[10] Wrong email rejected')
  try {
    await lookupByCode(orderCode, 'wrong@x.com')
    log('wrong email blocked', false)
  } catch {
    log('wrong email blocked', true)
  }

  console.log('\n— done —')
  process.exit(process.exitCode ?? 0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
