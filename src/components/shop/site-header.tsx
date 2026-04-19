import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="border-b border-border-warm bg-ivory">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          {process.env.NEXT_PUBLIC_SITE_NAME ?? 'Claude Shop'}
        </Link>
        <nav className="flex items-center gap-5 text-sm text-charcoal">
          <Link href="/" className="hover:text-terracotta">Sản phẩm</Link>
          <Link href="/orders" className="hover:text-terracotta">Tra cứu đơn</Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border-warm bg-ivory py-10 text-sm text-olive">
      <div className="mx-auto max-w-5xl px-6">
        © {new Date().getFullYear()} {process.env.NEXT_PUBLIC_SITE_NAME ?? 'Claude Shop'}. Giao hàng
        tự động, bảo hành minh bạch.
      </div>
    </footer>
  )
}
