import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-sand text-charcoal',
  success: 'bg-[#e6efe0] text-[#3b5d2b]',
  warning: 'bg-[#f5e6cc] text-[#7a5a17]',
  danger: 'bg-[#f4d9d9] text-error',
  info: 'bg-[#dde9f5] text-[#2a4d73]',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}
