import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

const ORDER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateOrderCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let out = ''
  for (const b of bytes) out += ORDER_ALPHABET[b % ORDER_ALPHABET.length]
  return `CLS-${out}`
}

export function qrUrl(amount: number, desc: string): string {
  const url = new URL('https://qr.sepay.vn/img')
  url.searchParams.set('acc', process.env.BANK_ACCOUNT_NO ?? '')
  url.searchParams.set('bank', process.env.BANK_BIN ?? '')
  url.searchParams.set('amount', String(amount))
  url.searchParams.set('des', desc)
  return url.toString()
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
