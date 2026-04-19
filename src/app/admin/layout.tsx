import Link from 'next/link'

const NAV = [
  { href: '/admin/orders', label: 'Đơn hàng' },
  { href: '/admin/stock', label: 'Kho' },
  { href: '/admin/products', label: 'Sản phẩm' },
  { href: '/admin/warranty', label: 'Bảo hành' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-border-warm bg-ivory">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin/orders" className="font-serif text-xl">
            Claude Shop Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {NAV.map((i) => (
              <Link key={i.href} href={i.href} className="text-charcoal hover:text-terracotta">
                {i.label}
              </Link>
            ))}
            <form action="/api/admin/logout" method="post">
              <button className="text-olive hover:text-error">Logout</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
