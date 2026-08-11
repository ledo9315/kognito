import Image from 'next/image'
import { cn } from '@/lib/utils'
import logo from '@/public/kognito-logo.png'

export function AppLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Image
        src={logo}
        alt=""
        width={24}
        height={24}
        priority
        className="size-6"
      />
      <span className="text-[15px] font-medium tracking-tight">Kognito</span>
    </span>
  )
}
