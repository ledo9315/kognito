import { cn } from '@/lib/utils'

export function AppLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-md bg-primary"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="size-3.5 text-primary-foreground"
          aria-hidden="true"
        >
          <path
            d="M3 2.5h4.2c.9 0 1.6.7 1.6 1.6v9.4c0-.7-.6-1.3-1.3-1.3H3V2.5Z"
            fill="currentColor"
            opacity="0.55"
          />
          <path
            d="M13 2.5H8.8c-.9 0-1.6.7-1.6 1.6v9.4c0-.7.6-1.3 1.3-1.3H13V2.5Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="text-[15px] font-medium tracking-tight">Kognito</span>
    </span>
  )
}
