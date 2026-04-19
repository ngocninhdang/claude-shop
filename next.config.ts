import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['@neondatabase/serverless', 'ws', 'bcryptjs'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qr.sepay.vn' },
    ],
  },
}

export default config
