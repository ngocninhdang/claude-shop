import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/shop/site-header'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-serif text-5xl">404</h1>
        <p className="mt-3 text-olive">Không tìm thấy trang bạn đang tìm.</p>
        <Link href="/" className="mt-6 inline-block text-terracotta hover:underline">
          ← Về trang chủ
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
