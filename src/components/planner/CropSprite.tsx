'use client'

import Image from 'next/image'
import type { CropDef } from '@/src/lib/garden-catalog'

// Pixel size of each sprite sheet, needed to scale it as a CSS background.
const SHEET_SIZE: Record<string, [number, number]> = {
  '/garden/crops-cornucopia.png': [256, 1472],
  '/garden/crops-more.png': [256, 1792],
  '/garden/trees.png': [288, 2960],
  '/garden/sl-biome.png': [144, 80],
  '/garden/sl-plants.png': [96, 32],
  '/garden/waterlily.png': [128, 32],
  '/garden/aq-caltrop.png': [80, 16],
  '/garden/aq-cattail.png': [80, 24]
}

/** One frame of a crop's sprite sheet, scaled to `height` px with crisp pixels. */
export function CropSprite({
  crop,
  frame,
  height
}: {
  crop: CropDef
  frame: [number, number]
  height: number
}) {
  const { sheet, w, h } = crop.stages
  const [sheetW, sheetH] = SHEET_SIZE[sheet] ?? [w, h]
  const scale = height / h
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: w * scale,
        height,
        imageRendering: 'pixelated',
        backgroundImage: `url(${sheet})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
        backgroundPosition: `${-frame[0] * scale}px ${-frame[1] * scale}px`
      }}
    />
  )
}

/** Shop/inventory icon: the crop's seed packet. */
export function CropIcon({ crop, alt }: { crop: CropDef; alt: string }) {
  return <Image src={crop.seedIcon} alt={alt} width={40} height={40} style={{ imageRendering: 'pixelated' }} />
}
