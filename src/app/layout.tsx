import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_SITE_NAME ?? 'Claude Shop',
    template: `%s · ${process.env.NEXT_PUBLIC_SITE_NAME ?? 'Claude Shop'}`,
  },
  description: 'Cung cấp tài khoản Claude chính hãng, bảo hành rõ ràng.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-parchment text-deep-dark antialiased"
      >
        {children}
      </body>
    </html>
  )
}
