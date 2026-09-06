import Image, { type StaticImageData } from 'next/image'
import { cn } from '@/lib/utils'

/**
 * A soft 3D render at the size of an icon square, for cards and tiles. The
 * pictures carry about 8 % of transparent margin for their glow; the scale
 * brings the visible square back to the full box. 32 px by default, a size
 * class in `className` (`size-10`) sets another box.
 */
export function IllustrationIcon({
  src,
  className,
}: {
  src: StaticImageData
  className?: string
}) {
  return (
    <span className={cn('flex size-8 items-center justify-center', className)}>
      <Image
        src={src}
        alt=""
        width={40}
        height={40}
        quality={90}
        className={cn('size-8 scale-[1.18] object-contain', className)}
      />
    </span>
  )
}
