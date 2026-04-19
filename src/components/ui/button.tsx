import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-terracotta text-ivory hover:bg-coral',
  secondary: 'bg-sand text-charcoal hover:bg-border-warm ring-shadow',
  ghost: 'bg-transparent text-charcoal hover:bg-sand',
  danger: 'bg-error text-ivory hover:opacity-90',
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
    />
  )
}
