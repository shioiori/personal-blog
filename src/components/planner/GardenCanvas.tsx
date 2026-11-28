'use client'

import { useEffect, useRef } from 'react'
import { CROPS, ORCHARD_ENABLED, getCrop, growthFrame } from '@/src/lib/garden-catalog'

export interface GardenPlot {
  id: number
  slotIndex: number
  kind: 'soil' | 'pond' | 'orchard'
  cropId: string | null
  fertilizerId: string | null
  plantedOn: string | null
  status: 'empty' | 'growing' | 'ready' | 'withered'
  daysElapsed: number
  growDays: number
  sellPrice: number
  mature: boolean
  fruitDaysLeft: number
}

// Map art is the 16px Tiny Garden pack (kathychow), drawn at an exact 2x. The map is
// larger than the view, which the camera scrolls over (arrow keys or dragging).
const SRC = 16
const TILE = 32
const HALF = TILE / 2
const COLS = 36
const ROWS = 30
const MAP_W = TILE * COLS
const MAP_H = TILE * ROWS
const VW = TILE * 25
const VH = TILE * 16
const CAMERA_SPEED = 520 // px per second while an arrow key is held
const KEY_STEP = 8 // px per keydown event (a tap, or each auto-repeat)

const RIPPLE = '#b9e6ff'

type XY = [number, number]

// Dirt and water are patches laid on plain grass. Each is drawn per 8px quarter: a quarter
// picks its shape from its two edge neighbours and the corner neighbour. The sheet has a
// lone tile (outer corners), a vertical strip (side edges), a horizontal strip (top and
// bottom edges), the inside of a big patch (full), and a 2x2 block whose four tiles each
// hold one inner corner, at the matching quarter.
interface PatchSet {
  outer: XY
  side: XY
  topBottom: XY
  full: XY
  inner: [XY, XY, XY, XY] // top-left, top-right, bottom-left, bottom-right quarter
}
const DIRT: PatchSet = { outer: [0, 0], side: [6, 1], topBottom: [3, 0], full: [3, 2], inner: [[0, 1], [1, 1], [0, 2], [1, 2]] }
const WATER: PatchSet = { outer: [7, 0], side: [13, 1], topBottom: [10, 0], full: [10, 2], inner: [[7, 1], [8, 1], [7, 2], [8, 2]] }
const GRASS: XY = [16, 5]
// The cobbled road comes as a two-tile-wide piece.
const COBBLE: [XY, XY] = [[15, 1], [16, 1]]
// Small things on the grass (row 5): tufts and sprigs, flowers, mushrooms, rocks, bushes.
const TUFTS: XY[] = [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]]
const FLOWERS: XY[] = [[5, 5], [8, 5], [9, 5], [10, 5]]
const MUSHROOMS: XY[] = [[6, 5], [7, 5]]
const ROCKS: XY[] = [[11, 5], [12, 5], [13, 5]]
const BUSHES: XY[] = [[14, 5], [15, 5]]
// The plank bridge (a north-south span, 12px wide) and its source rect.
const BRIDGE: XY = [14, 2]
// The tree (32x48) and the hut (48x48), in sheet pixels.
const TREE = { sx: 272, sy: 0, w: 32, h: 48 }
const HUT = { sx: 272, sy: 48, w: 48, h: 48 }

type Cell = 'water' | 'grass' | 'dirt' | 'path' | 'bridge'

// ---- Layout -------------------------------------------------------------------------
// Composed like the pack's own preview: everything close together, a winding river with
// plank bridges where the paths cross it, cobbled paths linking each place to the next,
// big trees framing the edges, and bushes, rocks and mushrooms tucked beside paths,
// buildings and banks.

// Vegetable bed beside the home: 7x7 dirt with a 3x3 grid of plots, one tile apart.
const BED = { col: 10, row: 3, size: 7 }
const PLOT_TILES: XY[] = []
for (let gy = 0; gy < 3; gy++) {
  for (let gx = 0; gx < 3; gx++) PLOT_TILES.push([BED.col + 1 + gx * 2, BED.row + 1 + gy * 2])
}

// The river: in from the west edge, then straight down into the lake. The lake lies
// between the two buildings (east to west, from the home's column to the shop's) and the
// road crosses it on a long bridge; a narrow stream leaves its east side and runs off the
// map. Water plants grow only in the lake.
const RIVER: { c0: number; r0: number; c1: number; r1: number }[] = [
  { c0: 0, r0: 13, c1: 10, r1: 14 },
  { c0: 9, r0: 13, c1: 10, r1: 21 },
  // the stream: one tile wide, with a single bend
  { c0: 26, r0: 24, c1: 31, r1: 24 },
  { c0: 31, r0: 24, c1: 31, r1: 25 },
  { c0: 31, r0: 25, c1: COLS - 1, r1: 25 }
]
const LAKE = { cx: 17, cy: 24, rx: 10.5, ry: 4.3 }
const POND_SLOT_BASE = 100
const POND_TILES: XY[] = [[10, 23], [14, 23], [18, 23], [12, 26], [16, 26], [25, 24]]

// Fruit trees grow on both sides of the north-south road. The tile is where the trunk
// stands; the tree (3x5 tiles) grows up from it. While the orchard is switched off
// (ORCHARD_ENABLED) the plots aren't drawn and decorative trees line the road instead.
const ORCHARD_SLOT_BASE = 200
const ORCHARD_ROWS = [5, 9, 13, 21, 25, 29]
const ORCHARD_TILES: XY[] = ORCHARD_ENABLED ? ORCHARD_ROWS.flatMap((r) => [[19, r], [24, r]] as XY[]) : []

// Cobbled paths. Where one crosses the river it becomes a plank bridge.
const ROADS: { c0: number; r0: number; c1: number; r1: number }[] = [
  { c0: 21, r0: 0, c1: 22, r1: ROWS - 1 }, // the north-south road, across the river
  // side paths are one tile wide
  { c0: 6, r0: 7, c1: 6, r1: 11 }, // down from the home's door
  { c0: 4, r0: 11, c1: 20, r1: 11 }, // along under the bed to the road
  { c0: 4, r0: 12, c1: 4, r1: 19 }, // over the west bridge to the meadow
  { c0: 30, r0: 7, c1: 30, r1: 12 }, // down from the shop's door
  { c0: 23, r0: 12, c1: 29, r1: 12 } // from the road to the shop path
]

// The pack's hut at 2x (3x3 tiles): the home (decoration), and the shop, the same hut
// with a teal roof (tg-shop.png), which opens the shop.
const HOUSE_RECT = { x: 5 * TILE, y: 4 * TILE, w: 96, h: 96 }
const SHOP_RECT = { x: 29 * TILE, y: 4 * TILE, w: 96, h: 96 }

type Decor = { kind: 'tree' | 'bush' | 'rock' | 'mushroom'; col: number; row: number }

// An avenue of trees along both sides of the north-south road (where the fruit trees grow
// when the orchard is on), clear of the paths that branch off it and of the river.
const AVENUE: Decor[] = ORCHARD_ENABLED
  ? []
  : [
      ...[3, 6, 9, 14, 19].map((row) => ({ kind: 'tree' as const, col: 19, row })),
      ...[3, 6, 9].map((row) => ({ kind: 'tree' as const, col: 24, row }))
    ]

// Trees, bushes, rocks and mushrooms: the tile each one stands on (base centred on it).
const DECOR: Decor[] = [
  ...AVENUE,
  // the other trees in clumps at the corners and edges, some cut off by the map edge
  { kind: 'tree', col: 1, row: 2 }, { kind: 'tree', col: 0, row: 5 }, { kind: 'tree', col: 2, row: 7 },
  { kind: 'tree', col: 11, row: 1 }, { kind: 'tree', col: 14, row: 0 },
  { kind: 'tree', col: 0, row: 19 }, { kind: 'tree', col: 1, row: 22 },
  { kind: 'tree', col: 0, row: 26 }, { kind: 'tree', col: 2, row: 29 }, { kind: 'tree', col: 5, row: 28 },
  { kind: 'tree', col: 10, row: 29 }, { kind: 'tree', col: 13, row: 29 },
  // the east edge, beside the shop and along the stream
  { kind: 'tree', col: 34, row: 2 }, { kind: 'tree', col: 35, row: 5 }, { kind: 'tree', col: 34, row: 9 },
  { kind: 'tree', col: 35, row: 13 }, { kind: 'tree', col: 33, row: 16 }, { kind: 'tree', col: 35, row: 20 },
  { kind: 'tree', col: 31, row: 21 }, { kind: 'tree', col: 33, row: 28 }, { kind: 'tree', col: 35, row: 29 },
  { kind: 'bush', col: 33, row: 22 }, { kind: 'bush', col: 29, row: 27 }, { kind: 'rock', col: 30, row: 23 },
  { kind: 'rock', col: 34, row: 26 }, { kind: 'mushroom', col: 32, row: 29 },
  // bushes beside the buildings, paths and banks
  { kind: 'bush', col: 8, row: 6 }, { kind: 'bush', col: 4, row: 9 }, { kind: 'bush', col: 17, row: 2 },
  { kind: 'bush', col: 27, row: 8 }, { kind: 'bush', col: 28, row: 6 },
  { kind: 'bush', col: 12, row: 18 }, { kind: 'bush', col: 8, row: 19 },
  { kind: 'bush', col: 27, row: 17 }, { kind: 'bush', col: 6, row: 25 }, { kind: 'bush', col: 9, row: 3 },
  // rocks on the banks and by the paths
  { kind: 'rock', col: 9, row: 12 }, { kind: 'rock', col: 2, row: 15 }, { kind: 'rock', col: 13, row: 17 },
  { kind: 'rock', col: 29, row: 14 },
  { kind: 'rock', col: 20, row: 0 }, { kind: 'rock', col: 6, row: 17 },
  // mushrooms in the shade of the trees
  { kind: 'mushroom', col: 2, row: 3 }, { kind: 'mushroom', col: 13, row: 2 },
  { kind: 'mushroom', col: 3, row: 27 }
]

// deterministic per-tile noise so decoration is fixed, not re-rolled every frame
function hash2(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

const pick = <T,>(list: T[], c: number, r: number): T => list[Math.floor(hash2(c, r) * list.length)]

function buildMap(): Cell[][] {
  const map: Cell[][] = []
  for (let r = 0; r < ROWS; r++) map.push(Array.from({ length: COLS }, () => 'grass' as Cell))
  const inMap = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS

  for (const w of RIVER) for (let r = w.r0; r <= w.r1; r++) for (let c = w.c0; c <= w.c1; c++) if (inMap(c, r)) map[r][c] = 'water'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dx = (c - LAKE.cx) / LAKE.rx
      const dy = (r - LAKE.cy) / LAKE.ry
      if (dx * dx + dy * dy <= 1) map[r][c] = 'water'
    }
  }
  for (const rd of ROADS) {
    for (let r = rd.r0; r <= rd.r1; r++) {
      for (let c = rd.c0; c <= rd.c1; c++) {
        if (inMap(c, r)) map[r][c] = map[r][c] === 'water' || map[r][c] === 'bridge' ? 'bridge' : 'path'
      }
    }
  }
  for (let dy = 0; dy < BED.size; dy++) for (let dx = 0; dx < BED.size; dx++) map[BED.row + dy][BED.col + dx] = 'dirt'
  // each tree stands on a 3-tile strip of dirt, its trunk on the middle tile
  for (const [c, r] of ORCHARD_TILES) for (let dx = -1; dx <= 1; dx++) if (inMap(c + dx, r)) map[r][c + dx] = 'dirt'
  return map
}

const MAP = buildMap()

// Past the map edge the land (or the river) carries on, so edges get no shoreline.
function cellAt(c: number, r: number): Cell {
  return MAP[Math.max(0, Math.min(ROWS - 1, r))][Math.max(0, Math.min(COLS - 1, c))]
}

// A bridge spans water: the banks are drawn as if it weren't there.
const isWater = (c: number, r: number) => cellAt(c, r) === 'water' || cellAt(c, r) === 'bridge'
const isOpenWater = (c: number, r: number) => cellAt(c, r) === 'water'
const isDirt = (c: number, r: number) => cellAt(c, r) === 'dirt'
const isGrass = (c: number, r: number) => cellAt(c, r) === 'grass'

// ---- Rendering ----------------------------------------------------------------------

interface Sheets {
  tiles: HTMLImageElement
  shop: HTMLImageElement
}

function drawTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, [tc, tr]: XY, c: number, r: number) {
  ctx.drawImage(img, tc * SRC, tr * SRC, SRC, SRC, c * TILE, r * TILE, TILE, TILE)
}

function drawPatch(ctx: CanvasRenderingContext2D, img: HTMLImageElement, set: PatchSet, c: number, r: number, test: (c: number, r: number) => boolean) {
  const Q = SRC / 2
  ;[[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([qx, qy], i) => {
    const dx = qx ? 1 : -1
    const dy = qy ? 1 : -1
    const vert = test(c, r + dy)
    const horiz = test(c + dx, r)
    const tile =
      !vert && !horiz ? set.outer
        : vert && !horiz ? set.side
          : !vert && horiz ? set.topBottom
            : test(c + dx, r + dy) ? set.full : set.inner[i]
    ctx.drawImage(img, tile[0] * SRC + qx * Q, tile[1] * SRC + qy * Q, Q, Q, c * TILE + qx * HALF, r * TILE + qy * HALF, HALF, HALF)
  })
}

const isPath = (c: number, r: number) => cellAt(c, r) === 'path' || cellAt(c, r) === 'bridge'

/**
 * Cobbles: the sheet's piece is two tiles wide, with natural edges on its outer sides. A
 * road's left column takes the left half and its right column the right half; a path one
 * tile wide is the left half's left side joined to the right half's right side.
 */
function drawCobble(ctx: CanvasRenderingContext2D, img: HTMLImageElement, c: number, r: number) {
  const left = isPath(c - 1, r)
  const right = isPath(c + 1, r)
  const [L, R] = COBBLE
  if (left && right) drawTile(ctx, img, COBBLE[c % 2], c, r)
  else if (right) drawTile(ctx, img, L, c, r)
  else if (left) drawTile(ctx, img, R, c, r)
  else {
    ctx.drawImage(img, L[0] * SRC, L[1] * SRC, SRC / 2, SRC, c * TILE, r * TILE, HALF, TILE)
    ctx.drawImage(img, R[0] * SRC + SRC / 2, R[1] * SRC, SRC / 2, SRC, c * TILE + HALF, r * TILE, HALF, TILE)
  }
}

/** A sprite from the sheet at 2x, its base centred on the bottom of tile (col, row). */
function drawSprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement, sx: number, sy: number, w: number, h: number, col: number, row: number) {
  ctx.drawImage(img, sx, sy, w, h, col * TILE + HALF - w, (row + 1) * TILE - h * 2, w * 2, h * 2)
}

// Everything except the water glints, pre-rendered once onto a canvas the size of the map.
function buildTerrain(s: Sheets): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      drawTile(ctx, s.tiles, GRASS, c, r)
      const cell = cellAt(c, r)
      if (cell === 'water') drawPatch(ctx, s.tiles, WATER, c, r, isWater)
      else if (cell === 'dirt') drawPatch(ctx, s.tiles, DIRT, c, r, isDirt)
      else if (cell === 'path') drawCobble(ctx, s.tiles, c, r)
      else if (cell === 'bridge') {
        drawPatch(ctx, s.tiles, WATER, c, r, isWater)
        // a two-tile-wide crossing: each half is nudged in so the planks meet in the middle
        const nudge = cellAt(c - 1, r) === 'bridge' ? -4 : cellAt(c + 1, r) === 'bridge' ? 4 : 0
        ctx.drawImage(s.tiles, BRIDGE[0] * SRC, BRIDGE[1] * SRC, SRC, SRC, c * TILE + nudge, r * TILE, TILE, TILE)
      }
    }
  }

  // tufts, flowers, mushrooms and pebbles on open grass, away from everything built
  const nearDecor = (c: number, r: number) => DECOR.some((d) => Math.abs(d.col - c) <= 1 && r <= d.row && r >= d.row - 2)
  const nearHut = (c: number, r: number, rect: { x: number; y: number }) =>
    c >= rect.x / TILE - 1 && c <= rect.x / TILE + 3 && r >= rect.y / TILE - 1 && r <= rect.y / TILE + 3
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isGrass(c, r) || nearDecor(c, r) || nearHut(c, r, HOUSE_RECT) || nearHut(c, r, SHOP_RECT)) continue
      const h = hash2(r * 5 + 1, c * 3 + 2)
      const tile = h < 0.09 ? pick(TUFTS, c, r) : h < 0.115 ? pick(FLOWERS, c, r) : null
      if (tile) drawTile(ctx, s.tiles, tile, c, r)
    }
  }

  // objects, back to front
  const objects: { bottom: number; draw: () => void }[] = []
  for (const d of DECOR) {
    objects.push({
      bottom: (d.row + 1) * TILE,
      draw: () => {
        if (d.kind === 'tree') drawSprite(ctx, s.tiles, TREE.sx, TREE.sy, TREE.w, TREE.h, d.col, d.row)
        else drawTile(ctx, s.tiles, pick(d.kind === 'bush' ? BUSHES : d.kind === 'rock' ? ROCKS : MUSHROOMS, d.col, d.row), d.col, d.row)
      }
    })
  }
  objects.push({ bottom: HOUSE_RECT.y + HOUSE_RECT.h, draw: () => ctx.drawImage(s.tiles, HUT.sx, HUT.sy, HUT.w, HUT.h, HOUSE_RECT.x, HOUSE_RECT.y, HOUSE_RECT.w, HOUSE_RECT.h) })
  objects.push({ bottom: SHOP_RECT.y + SHOP_RECT.h, draw: () => ctx.drawImage(s.shop, SHOP_RECT.x, SHOP_RECT.y, SHOP_RECT.w, SHOP_RECT.h) })
  objects.sort((a, b) => a.bottom - b.bottom)
  for (const o of objects) o.draw()
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

/** Where a plot sits on the map, or null for a slot this map has no tile for. */
function plotRect(plot: GardenPlot): Rect | null {
  const tile =
    plot.kind === 'orchard'
      ? ORCHARD_TILES[plot.slotIndex - ORCHARD_SLOT_BASE]
      : plot.kind === 'pond'
        ? POND_TILES[plot.slotIndex - POND_SLOT_BASE]
        : PLOT_TILES[plot.slotIndex]
  if (!tile) return null
  const [c, r] = tile
  return { x: c * TILE, y: r * TILE, w: TILE, h: TILE }
}

/** The area a click on a plot covers: half-way into the gaps, or the whole tree. */
function hitRect(plot: GardenPlot): Rect | null {
  const r = plotRect(plot)
  if (!r) return null
  const up = plot.kind === 'orchard' ? TILE * 4 : TILE / 2
  const side = plot.kind === 'orchard' ? TILE : TILE / 2
  return { x: r.x - side, y: r.y - up, w: r.w + side * 2, h: r.h + up + TILE / 2 }
}

function drawWaterGlints(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, t: number) {
  const c0 = Math.floor(cam.x / TILE)
  const r0 = Math.floor(cam.y / TILE)
  ctx.fillStyle = RIPPLE
  for (let r = r0; r <= r0 + VH / TILE; r++) {
    for (let c = c0; c <= c0 + VW / TILE; c++) {
      // only away from the banks, where the tile is open water
      if (!isOpenWater(c, r) || !isOpenWater(c - 1, r) || !isOpenWater(c + 1, r) || !isOpenWater(c, r - 1) || !isOpenWater(c, r + 1)) continue
      const h = hash2(c, r)
      if (h > 0.45) continue
      const phase = t / 2600 + h * 7
      const alpha = Math.sin(phase * Math.PI * 2)
      if (alpha <= 0) continue
      ctx.globalAlpha = alpha * 0.6
      const x = c * TILE + 4 + Math.round(((phase % 1) * 10) / 2) * 2
      const y = r * TILE + 6 + Math.floor(h * 20)
      ctx.fillRect(x, y, 6, 2)
      ctx.fillRect(x + 12, y + 6, 4, 2)
    }
  }
  ctx.globalAlpha = 1
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

  const crop = getCrop(plot.cropId)
  if (!crop) return
  const stages = crop.stages
  const img = loadImage(stages.sheet)
  if (!img.complete || img.naturalWidth === 0) return

  const ready = plot.status === 'ready'
  const frame = growthFrame(stages, plot.status, plot.daysElapsed, plot.growDays, plot.mature)

  // Land and water plants: 3x the 16px art so every plant has the same pixel size; tall
  // frames grow upward from the bottom of the plot tile, like crops in the source games
  // (a 16px lily pad ends up centred on its tile). Water plants drift gently.
  // Trees: 2x (their 48x80 art would not fit at 3x), trunk on the tile.
  const scale = crop.tree ? 2 : 3
  const dw = stages.w * scale
  const dh = stages.h * scale
  const left = x + (w - dw) / 2
  const top = crop.tree ? y + h + 4 - dh : y + h + 8 - dh
  const bob = crop.tree ? 0 : ready ? Math.round(Math.sin(t / 220) * 2) : crop.water ? Math.round(Math.sin(t / 600 + plot.slotIndex)) : 0

  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (plot.status === 'withered') ctx.filter = 'grayscale(0.9) brightness(0.8)'
  ctx.drawImage(img, frame[0], frame[1], stages.w, stages.h, left, top + bob, dw, dh)
  ctx.restore()

  if (ready && Math.sin(t / 180) > 0) drawPixelSparkle(ctx, left + dw - 4, crop.tree ? top + 12 : y - 4)
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

const clampCam = (cam: { x: number; y: number }) => {
  cam.x = Math.max(0, Math.min(MAP_W - VW, cam.x))
  cam.y = Math.max(0, Math.min(MAP_H - VH, cam.y))
}

// Where the camera was, kept while the page is open so switching tabs doesn't reset it.
// It starts on the home, the vegetable bed and the road.
const savedCam = { x: 0, y: 1 * TILE }

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
}

export function GardenCanvas({
  plots,
  balance,
  shovel,
  keysEnabled,
  onPlotClick,
  onShopClick
}: {
  plots: GardenPlot[]
  balance: number
  /** Shovel mode: the plot under the cursor is outlined if it has something to dig up. */
  shovel: boolean
  /** Arrow keys move the camera only while this is set (e.g. no dialog is open). */
  keysEnabled: boolean
  onPlotClick: (plot: GardenPlot) => void
  onShopClick: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const plotsRef = useRef(plots)
  plotsRef.current = plots
  const balanceRef = useRef(balance)
  balanceRef.current = balance
  const shovelRef = useRef(shovel)
  shovelRef.current = shovel
  const keysEnabledRef = useRef(keysEnabled)
  keysEnabledRef.current = keysEnabled
  const hoverRef = useRef<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ id: number; sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    for (const c of CROPS) loadImage(c.stages.sheet)
    const sheets: Sheets = {
      tiles: loadImage('/garden/tg-tiles.png'),
      shop: loadImage('/garden/tg-shop.png')
    }

    let terrain: HTMLCanvasElement | null = null
    let cancelled = false
    Promise.all(Object.values(sheets).map(whenLoaded)).then(() => {
      if (!cancelled) terrain = buildTerrain(sheets)
    })

    const held = new Set<string>()
    function onKeyDown(e: KeyboardEvent) {
      if (!ARROWS[e.key] || !keysEnabledRef.current) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      e.preventDefault()
      held.add(e.key)
      // a tap (or each key repeat) nudges the camera even if no frame ran meanwhile
      savedCam.x += ARROWS[e.key][0] * KEY_STEP
      savedCam.y += ARROWS[e.key][1] * KEY_STEP
      clampCam(savedCam)
    }
    function onKeyUp(e: KeyboardEvent) { held.delete(e.key) }
    function onBlur() { held.clear() }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    let raf = 0
    let last = 0
    function frame(t: number) {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
      last = t
      if (!keysEnabledRef.current) held.clear()
      for (const k of held) {
        savedCam.x += ARROWS[k][0] * CAMERA_SPEED * dt
        savedCam.y += ARROWS[k][1] * CAMERA_SPEED * dt
      }
      clampCam(savedCam)
      const cam = { x: Math.round(savedCam.x), y: Math.round(savedCam.y) }

      ctx!.imageSmoothingEnabled = false
      ctx!.save()
      ctx!.translate(-cam.x, -cam.y)
      if (terrain) {
        ctx!.drawImage(terrain, cam.x, cam.y, VW, VH, cam.x, cam.y, VW, VH)
        drawWaterGlints(ctx!, cam, t)
        // plots back to front, so a lower tree overlaps the one above it
        const visible = plotsRef.current
          .map((p) => ({ p, r: plotRect(p) }))
          .filter((o): o is { p: GardenPlot; r: Rect } =>
            !!o.r && o.r.x > cam.x - 3 * TILE && o.r.x < cam.x + VW + 2 * TILE && o.r.y > cam.y - TILE && o.r.y < cam.y + VH + 6 * TILE)
          .sort((a, b) => a.r.y - b.r.y)
        for (const { p, r } of visible) drawPlot(ctx!, p, r, t)

        // shovel mode: outline the plot under the cursor if there is something to dig up
        const hover = hoverRef.current
        if (shovelRef.current && hover) {
          const target = plotAt(hover.x, hover.y)
          const r = target?.cropId ? hitRect(target) : null
          if (r) {
            ctx!.strokeStyle = 'rgba(255, 90, 60, 0.9)'
            ctx!.lineWidth = 2
            ctx!.setLineDash([6, 4])
            ctx!.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
            ctx!.setLineDash([])
          }
        }
      }
      ctx!.restore()

      drawCoinHud(ctx!, balanceRef.current)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  /** The plot under a world point; where trees overlap, the front one. */
  function plotAt(x: number, y: number): GardenPlot | undefined {
    return plotsRef.current
      .map((p) => ({ p, r: hitRect(p) }))
      .filter((o) => o.r && x >= o.r.x && x <= o.r.x + o.r.w && y >= o.r.y && y <= o.r.y + o.r.h)
      .sort((a, b) => b.r!.y - a.r!.y)[0]?.p
  }

  /** Canvas pixels per CSS pixel (the canvas is scaled to fit its column). */
  function scaleOf(): number {
    return VW / canvasRef.current!.getBoundingClientRect().width
  }

  function toWorld(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const k = VW / rect.width
    return { x: (e.clientX - rect.left) * k + Math.round(savedCam.x), y: (e.clientY - rect.top) * k + Math.round(savedCam.y) }
  }

  function handleClick(x: number, y: number) {
    if (!shovelRef.current && x >= SHOP_RECT.x && x <= SHOP_RECT.x + SHOP_RECT.w && y >= SHOP_RECT.y && y <= SHOP_RECT.y + SHOP_RECT.h) {
      onShopClick()
      return
    }
    const plot = plotAt(x, y)
    if (plot) onPlotClick(plot)
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: savedCam.x, cy: savedCam.y, moved: false }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    hoverRef.current = toWorld(e)
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) > 5) {
      d.moved = true
      canvasRef.current?.setPointerCapture(e.pointerId)
    }
    if (d.moved) {
      const k = scaleOf()
      savedCam.x = d.cx - dx * k
      savedCam.y = d.cy - dy * k
      clampCam(savedCam)
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current
    dragRef.current = null
    if (!d || d.id !== e.pointerId) return
    if (d.moved) {
      canvasRef.current?.releasePointerCapture(e.pointerId)
      return
    }
    const p = toWorld(e)
    handleClick(p.x, p.y)
  }

  return (
    <canvas
      ref={canvasRef}
      width={VW}
      height={VH}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragRef.current = null }}
      onPointerLeave={() => { hoverRef.current = null }}
      className={`mx-auto block w-full max-w-[800px] touch-none select-none rounded-lg shadow-xl ${shovel ? 'cursor-crosshair' : 'cursor-pointer'}`}
      style={{ imageRendering: 'pixelated', aspectRatio: `${VW} / ${VH}` }}
    />
  )
}
