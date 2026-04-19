import { cn } from '@/lib/utils'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-md bg-white px-3 py-2 text-sm outline-none ring-shadow focus:ring-2 focus:ring-focus',
        className,
      )}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-md bg-white px-3 py-2 text-sm outline-none ring-shadow focus:ring-2 focus:ring-focus',
        className,
      )}
    />
  )
}
