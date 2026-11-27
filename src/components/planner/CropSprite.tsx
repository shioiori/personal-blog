'use client'

import Image from 'next/image'
import type { CropDef } from '@/src/lib/garden-catalog'

// Pixel size of each sprite sheet, needed to scale it as a CSS background.
const SHEET_SIZE: Record<string, [number, number]> = {
  '/garden/crops-cornucopia.png': [256, 1472],
  '/garden/sl-biome.png': [144, 80],
  '/garden/sl-plants.png': [96, 32],
  '/garden/aq-lotus.png': [160, 32],
  '/garden/aq-caltrop.png': [160, 32],
  '/garden/aq-cattail.png': [160, 48]
}

/** One frame of a crop's sprite sheet, scaled to `height` px with crisp pixels. */
export function CropSprite({
  crop,
  frame,
  overlay,
  height
}: {
  crop: CropDef
  frame: [number, number]
  overlay?: [number, number]
  height: number
}) {
  const { sheet, w, h } = crop.stages
  const [sheetW, sheetH] = SHEET_SIZE[sheet] ?? [w, h]
  const scale = height / h
  const layers: [number, number, number, number][] = []
  // Overlay first: the first CSS background layer is painted on top.
  if (overlay) layers.push([overlay[0], overlay[1], -1, -3])
  layers.push([frame[0], frame[1], 0, 0])
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: w * scale,
        height,
        imageRendering: 'pixelated',
        backgroundImage: layers.map(() => `url(${sheet})`).join(', '),
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
        backgroundPosition: layers.map(([sx, sy, dx, dy]) => `${(dx - sx) * scale}px ${(dy - sy) * scale}px`).join(', ')
      }}
    />
  )
}

/** Shop/inventory icon: the crop's seed packet. */
export function CropIcon({ crop, alt }: { crop: CropDef; alt: string }) {
  return <Image src={crop.seedIcon} alt={alt} width={40} height={40} style={{ imageRendering: 'pixelated' }} />
}
