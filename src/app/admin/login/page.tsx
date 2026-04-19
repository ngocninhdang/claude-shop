import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import bcrypt from 'bcryptjs'
import { ADMIN_COOKIE_MAX_AGE, ADMIN_COOKIE_NAME, signAdminToken, verifyAdminToken } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export const metadata = { title: 'Admin Login' }

async function loginAction(formData: FormData) {
  'use server'

  const ip = getClientIp(await headers())
  if (!rateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
    throw new Error('Quá nhiều lần thử. Đợi 15 phút.')
  }

  const password = String(formData.get('password') ?? '')
  const hash = process.env.ADMIN_PASSWORD_HASH
  if (!hash) throw new Error('ADMIN_PASSWORD_HASH chưa cấu hình')

  const ok = await bcrypt.compare(password, hash)
  if (!ok) throw new Error('Sai mật khẩu')

  const token = await signAdminToken()
  const store = await cookies()
  store.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  })
  redirect('/admin/orders')
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE_NAME)?.value
  if (token && (await verifyAdminToken(token))) {
    redirect(params.next ?? '/admin/orders')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-parchment p-6">
      <div className="w-full max-w-sm rounded-xl bg-ivory p-8 ring-shadow">
        <h1 className="mb-1 font-serif text-3xl">Admin</h1>
        <p className="mb-6 text-sm text-olive">Đăng nhập để quản lý cửa hàng.</p>
        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-charcoal">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="w-full rounded-md bg-white px-3 py-2 text-sm outline-none ring-shadow focus:ring-2 focus:ring-focus"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-terracotta px-3 py-2 text-sm font-medium text-ivory hover:bg-coral"
          >
            Đăng nhập
          </button>
          {params.error ? (
            <p className="text-sm text-error">{params.error}</p>
          ) : null}
        </form>
      </div>
    </main>
  )
}
