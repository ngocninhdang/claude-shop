'use client'

import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-terracotta text-ivory hover:bg-coral',
  secondary: 'bg-sand text-charcoal hover:bg-border-warm ring-shadow',
  ghost: 'bg-transparent text-charcoal hover:bg-sand',
  danger: 'bg-error text-ivory hover:opacity-90',
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: Variant
  pendingLabel?: string
  children: ReactNode
}

export function SubmitButton({
  className,
  variant = 'primary',
  pendingLabel = 'Đang xử lý…',
  children,
  ...props
}: Props) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
