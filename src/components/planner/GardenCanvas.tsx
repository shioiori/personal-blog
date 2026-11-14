'use client'

import { useEffect, useRef } from 'react'
import { CROPS } from '@/src/lib/garden-catalog'

export interface GardenPlot {
  id: number
  slotIndex: number
  cropId: string | null
  fertilizerId: string | null
  plantedOn: string | null
  status: 'empty' | 'growing' | 'ready' | 'withered'
  daysElapsed: number
  growDays: number
  sellPrice: number
}

// Source art is 16px (Sprout Lands); everything is drawn at an exact 2x.
const SRC = 16
const TILE = 32
const COLS = 25
const ROWS = 16
const W = TILE * COLS
const H = TILE * ROWS

// Neighbour bitmask -> [col, row]; grass and tilled dirt share this Sprout Lands layout.
// N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128; a corner bit counts only when both
// adjacent edges are set too.
const GRASS_TILES: Record<number, [number, number]> = {
  0: [3, 3], 1: [3, 2], 2: [0, 3], 3: [4, 3], 4: [3, 0], 5: [3, 1], 6: [4, 0], 7: [4, 4],
  8: [2, 3], 9: [7, 3], 10: [1, 3], 11: [8, 3], 12: [7, 0], 13: [7, 4], 14: [8, 0], 15: [8, 4],
  19: [0, 2], 23: [4, 1], 27: [6, 3], 31: [9, 3], 38: [0, 0], 39: [4, 2], 46: [6, 0], 47: [9, 2],
  55: [0, 1], 63: [6, 4], 76: [2, 0], 77: [7, 2], 78: [5, 0], 79: [10, 2], 95: [9, 0], 110: [1, 0],
  111: [8, 2], 127: [6, 2], 137: [2, 2], 139: [5, 3], 141: [7, 1], 143: [10, 3], 155: [1, 2],
  159: [8, 1], 175: [9, 1], 191: [6, 1], 205: [2, 1], 207: [5, 4], 223: [5, 1], 239: [5, 2],
  255: [1, 1]
}

// Full grass variants (blades, patches, flowers) sprinkled on interior tiles.
const GRASS_VARIANTS: [number, number][] = [
  [0, 5], [1, 5], [2, 5], [0, 6], [1, 6], [2, 6], [3, 5], [4, 5], [5, 5], [5, 6]
]

type Cell = 'water' | 'grass' | 'dirt'

// One 9x9 tilled bed. Tilled dirt is drawn inset ~10px from its outer tiles, so the
// 3x3 grid of plots sits one tile in, with a one-tile gap between plots.
const BED = { col: 3, row: 3, size: 9 }
const PLOT_TILES: [number, number][] = []
for (let gy = 0; gy < 3; gy++) {
  for (let gx = 0; gx < 3; gx++) PLOT_TILES.push([BED.col + 2 + gx * 2, BED.row + 2 + gy * 2])
}

const NOTCHES: [number, number][] = [
  [1, 1], [2, 1], [3, 1], [1, 2], [1, 3],
  [21, 1], [22, 1], [23, 1], [23, 2], [23, 3],
  [1, 14], [2, 14], [3, 14], [1, 13], [1, 12],
  [21, 14], [22, 14], [23, 14], [23, 13], [23, 12],
  [11, 1], [12, 1], [13, 1],
  [1, 7], [1, 8], [23, 7], [23, 8],
  [12, 14], [13, 14]
]

// The shop is the 48x48 hut from Sprout Lands, drawn at 2x (3x3 tiles).
const SHOP_RECT = { x: 17 * TILE, y: 3 * TILE, w: 96, h: 96 }

// Decorations from sl-biome.png: source rect + top-left tile to draw at.
const DECOR: { sx: number; sy: number; sw: number; sh: number; col: number; row: number }[] = [
  { sx: 48, sy: 0, sw: 32, sh: 32, col: 21, row: 4 },   // apple tree
  { sx: 0, sy: 48, sw: 16, sh: 16, col: 15, row: 12 },  // berry bush
  { sx: 128, sy: 16, sw: 16, sh: 16, col: 19, row: 11 },// rock
  { sx: 112, sy: 64, sw: 16, sh: 16, col: 12, row: 1 }, // lily pad
  { sx: 128, sy: 64, sw: 16, sh: 16, col: 0, row: 6 },  // lily pads
  { sx: 112, sy: 64, sw: 16, sh: 16, col: 24, row: 9 }  // lily pad
]

function buildMap(): Cell[][] {
  const map: Cell[][] = []
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = []
    for (let c = 0; c < COLS; c++) {
      const land = c >= 1 && c <= COLS - 2 && r >= 1 && r <= ROWS - 2
      row.push(land ? 'grass' : 'water')
    }
    map.push(row)
  }
  for (const [c, r] of NOTCHES) map[r][c] = 'water'
  for (let dy = 0; dy < BED.size; dy++) for (let dx = 0; dx < BED.size; dx++) map[BED.row + dy][BED.col + dx] = 'dirt'
  return map
}

const MAP = buildMap()

function cellAt(c: number, r: number): Cell {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 'water'
  return MAP[r][c]
}

function neighbourMask(c: number, r: number, test: (c: number, r: number) => boolean): number {
  const n = test(c, r - 1)
  const e = test(c + 1, r)
  const s = test(c, r + 1)
  const w = test(c - 1, r)
  let mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0)
  if (n && e && test(c + 1, r - 1)) mask |= 16
  if (s && e && test(c + 1, r + 1)) mask |= 32
  if (s && w && test(c - 1, r + 1)) mask |= 64
  if (n && w && test(c - 1, r - 1)) mask |= 128
  return mask
}

const isLand = (c: number, r: number) => cellAt(c, r) !== 'water'
const isDirt = (c: number, r: number) => cellAt(c, r) === 'dirt'

// deterministic per-tile noise so decoration is fixed, not re-rolled every frame
function hash2(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function occupiedByDecor(c: number, r: number): boolean {
  for (const d of DECOR) {
    const w = d.sw / SRC
    const h = d.sh / SRC
    if (c >= d.col && c < d.col + w && r >= d.row && r < d.row + h) return true
  }
  const shopCol = SHOP_RECT.x / TILE
  const shopRow = SHOP_RECT.y / TILE
  return c >= shopCol && c < shopCol + 3 && r >= shopRow && r < shopRow + 3
}

interface Sheets {
  grass: HTMLImageElement
  dirt: HTMLImageElement
  shop: HTMLImageElement
  biome: HTMLImageElement
}

function drawTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, [tc, tr]: [number, number], c: number, r: number) {
  ctx.drawImage(img, tc * SRC, tr * SRC, SRC, SRC, c * TILE, r * TILE, TILE, TILE)
}

// Everything except the animated water, pre-rendered once onto a transparent canvas.
function buildTerrain(sheets: Sheets): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isLand(c, r)) continue
      const mask = neighbourMask(c, r, isLand)
      const plain = mask === 255 && !isDirt(c, r) && !occupiedByDecor(c, r) && hash2(c, r) < 0.22
      const tile = plain ? GRASS_VARIANTS[Math.floor(hash2(r, c) * GRASS_VARIANTS.length)] : GRASS_TILES[mask]
      drawTile(ctx, sheets.grass, tile, c, r)
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isDirt(c, r)) drawTile(ctx, sheets.dirt, GRASS_TILES[neighbourMask(c, r, isDirt)], c, r)
    }
  }

  for (const d of DECOR) {
    ctx.drawImage(sheets.biome, d.sx, d.sy, d.sw, d.sh, d.col * TILE, d.row * TILE, d.sw * 2, d.sh * 2)
  }
  ctx.drawImage(sheets.shop, SHOP_RECT.x, SHOP_RECT.y, SHOP_RECT.w, SHOP_RECT.h)
  return canvas
}

const imageCache = new Map<string, HTMLImageElement>()
function loadImage(src: string): HTMLImageElement {
  let img = imageCache.get(src)
  if (!img) {
    img = new window.Image()
    img.src = src
    imageCache.set(src, img)
  }
  return img
}

function whenLoaded(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true })
  })
}

interface Rect { x: number; y: number; w: number; h: number }

function plotRect(index: number): Rect {
  const [c, r] = PLOT_TILES[index]
  return { x: c * TILE, y: r * TILE, w: TILE, h: TILE }
}

function drawWater(ctx: CanvasRenderingContext2D, water: HTMLImageElement, t: number) {
  const frame = Math.floor(t / 300) % 4
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.drawImage(water, frame * SRC, 0, SRC, SRC, c * TILE, r * TILE, TILE, TILE)
    }
  }
}

function drawPixelSparkle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 1, y - 5, 2, 10)
  ctx.fillRect(x - 5, y - 1, 10, 2)
}

function drawPlot(ctx: CanvasRenderingContext2D, plot: GardenPlot, rect: Rect, t: number) {
  const { x, y, w, h } = rect

  if (plot.status === 'empty' || !plot.cropId) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillRect(x + w / 2 - 1, y + h / 2 - 7, 2, 14)
    ctx.fillRect(x + w / 2 - 7, y + h / 2 - 1, 14, 2)
    return
  }

  const stages = CROPS.find((c) => c.id === plot.cropId)?.stages
  if (!stages) return
  const img = loadImage(stages.sheet)
  if (!img.complete || img.naturalWidth === 0) return

  const ready = plot.status === 'ready'
  let frame = stages.ripe
  if (plot.status === 'growing') {
    const progress = plot.growDays > 0 ? plot.daysElapsed / plot.growDays : 0
    frame = stages.growing[Math.min(stages.growing.length - 1, Math.floor(progress * stages.growing.length))]
  }

  // 3x the 16px art so the plant fills its plot; tall frames grow upward from the
  // bottom of the plot tile, like crops in the source games
  const dw = stages.w * 3
  const dh = stages.h * 3
  const left = x + (w - dw) / 2
  const top = y + h + 8 - dh
  const bob = ready ? Math.round(Math.sin(t / 220) * 2) : 0

  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (plot.status === 'withered') ctx.filter = 'grayscale(0.9) brightness(0.8)'
  ctx.drawImage(img, frame[0], frame[1], stages.w, stages.h, left, top + bob, dw, dh)
  ctx.restore()

  if (ready && Math.sin(t / 180) > 0) drawPixelSparkle(ctx, left + dw - 4, y - 4)
}

function drawCoinHud(ctx: CanvasRenderingContext2D, balance: number) {
  const x = 12
  const y = 12
  const text = String(balance)
  ctx.save()
  ctx.font = 'bold 16px monospace'
  const pillW = Math.max(72, 40 + ctx.measureText(text).width)

  ctx.fillStyle = 'rgba(30,20,10,0.75)'
  ctx.fillRect(x, y, pillW, 30)
  ctx.fillStyle = 'rgba(255,215,120,0.6)'
  ctx.fillRect(x, y, pillW, 2)

  ctx.fillStyle = '#c98a16'
  ctx.fillRect(x + 8, y + 7, 16, 16)
  ctx.fillStyle = '#ffd24d'
  ctx.fillRect(x + 10, y + 9, 12, 12)
  ctx.fillStyle = '#fff3b0'
  ctx.fillRect(x + 11, y + 10, 4, 4)

  ctx.fillStyle = '#fff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + 32, y + 16)
  ctx.restore()
}

export function GardenCanvas({
  plots,
  balance,
  onPlotClick,
  onShopClick
}: {
  plots: GardenPlot[]
  balance: number
  onPlotClick: (plot: GardenPlot) => void
  onShopClick: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const plotsRef = useRef(plots)
  plotsRef.current = plots
  const balanceRef = useRef(balance)
  balanceRef.current = balance

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    for (const c of CROPS) loadImage(c.stages.sheet)
    const water = loadImage('/garden/sl-water.png')
    const sheets: Sheets = {
      grass: loadImage('/garden/sl-grass.png'),
      dirt: loadImage('/garden/sl-dirt.png'),
      shop: loadImage('/garden/sl-shop.png'),
      biome: loadImage('/garden/sl-biome.png')
    }

    let terrain: HTMLCanvasElement | null = null
    let cancelled = false
    Promise.all([water, ...Object.values(sheets)].map(whenLoaded)).then(() => {
      if (!cancelled) terrain = buildTerrain(sheets)
    })

    let raf = 0
    function frame(t: number) {
      ctx!.imageSmoothingEnabled = false
      if (terrain) {
        drawWater(ctx!, water, t)
        ctx!.drawImage(terrain, 0, 0)
      } else {
        ctx!.fillStyle = '#9bd4c3'
        ctx!.fillRect(0, 0, W, H)
      }

      plotsRef.current.slice(0, PLOT_TILES.length).forEach((plot, i) => drawPlot(ctx!, plot, plotRect(i), t))

      drawCoinHud(ctx!, balanceRef.current)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (W / rect.width)
    const y = (e.clientY - rect.top) * (H / rect.height)

    if (x >= SHOP_RECT.x && x <= SHOP_RECT.x + SHOP_RECT.w && y >= SHOP_RECT.y && y <= SHOP_RECT.y + SHOP_RECT.h) {
      onShopClick()
      return
    }

    // each plot's hit area reaches half-way into the gap around it
    const pad = TILE / 2
    const plot = plotsRef.current.slice(0, PLOT_TILES.length).find((_, i) => {
      const r = plotRect(i)
      return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad
    })
    if (plot) onPlotClick(plot)
  }

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleClick}
      className="mx-auto block w-full max-w-[800px] cursor-pointer rounded-lg shadow-xl"
      style={{ imageRendering: 'pixelated', aspectRatio: `${W} / ${H}` }}
    />
  )
}
