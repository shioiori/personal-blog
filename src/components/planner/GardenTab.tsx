'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { GameButton, GameModal, GameSectionTitle, GameSlot } from './GameUI'
import { CROPS, HARVEST_INTEREST, ORCHARD_ENABLED, WITHER_AFTER_DAYS, getCrop, growthFrame, type CropDef } from '@/src/lib/garden-catalog'
import { GardenCanvas, type GardenPlot } from './GardenCanvas'
import { CropIcon, CropSprite } from './CropSprite'

const plotKindOf = (c: CropDef): GardenPlot['kind'] => (c.tree ? 'orchard' : c.water ? 'pond' : 'soil')
const LAND_CROPS = CROPS.filter((c) => plotKindOf(c) === 'soil')
const WATER_CROPS = CROPS.filter((c) => plotKindOf(c) === 'pond')
const TREE_CROPS = CROPS.filter((c) => plotKindOf(c) === 'orchard')

export function GardenTab() {
  const t = useTranslations('Planner')
  const [plots, setPlots] = useState<GardenPlot[]>([])
  const [balance, setBalance] = useState(0)
  const [inventory, setInventory] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [plantingPlot, setPlantingPlot] = useState<GardenPlot | null>(null)
  const [selectedCrop, setSelectedCrop] = useState<string>('')
  const [infoPlot, setInfoPlot] = useState<GardenPlot | null>(null)
  const [shopOpen, setShopOpen] = useState(false)
  const [shopSelected, setShopSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shovel, setShovel] = useState(false)

  const refetch = useCallback(async () => {
    const res = await fetch('/api/planner/garden')
    if (res.ok) {
      const data = await res.json()
      setPlots(data.plots)
      setBalance(data.balance)
      setInventory(data.inventory ?? {})
    }
    setLoading(false)
  }, [])

  useEffect(() => { void refetch() }, [refetch])

  function openPlant(plot: GardenPlot) {
    setPlantingPlot(plot)
    setSelectedCrop('')
  }

  async function handlePlant() {
    if (!plantingPlot || !selectedCrop) return
    setBusy(true)
    try {
      const res = await fetch('/api/planner/garden/plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plotId: plantingPlot.id, cropId: selectedCrop })
      })
      if (!res.ok) {
        toast.error(t('plantError'))
        return
      }
      setPlantingPlot(null)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  async function handleHarvest(plot: GardenPlot) {
    setBusy(true)
    try {
      const res = await fetch('/api/planner/garden/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plotId: plot.id })
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'withered') {
          toast.error(t('witheredToast'))
          await refetch()
        } else {
          toast.error(t('harvestError'))
        }
        return
      }
      toast.success(t('harvestedToast', { amount: data.earned }))
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  async function handleBuy(itemId: string, name: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/planner/garden/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, qty: 1 })
      })
      if (!res.ok) {
        toast.error(t('buyError'))
        return
      }
      toast.success(t('boughtToast', { name }))
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveTree(plot: GardenPlot) {
    if (busy || !window.confirm(t('removeTreeConfirm'))) return
    setBusy(true)
    try {
      const res = await fetch('/api/planner/garden/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plotId: plot.id })
      })
      if (!res.ok) {
        toast.error(t('removeError'))
        return
      }
      toast.success(t('removedToast'))
      setInfoPlot(null)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  // The shovel digs up whatever grows in a plot, at once and without a refund.
  async function handleDig(plot: GardenPlot) {
    setBusy(true)
    try {
      const res = await fetch('/api/planner/garden/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plotId: plot.id })
      })
      if (!res.ok) {
        toast.error(t('digError'))
        return
      }
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  // A pond plot takes only water plants, an orchard plot only trees, a soil plot only
  // land crops.
  const plantingKind = plantingPlot?.kind ?? 'soil'
  const ownedSeeds = CROPS.filter((c) => plotKindOf(c) === plantingKind && (inventory[`seed:${c.id}`] ?? 0) > 0)

  function handlePlotClick(plot: GardenPlot) {
    if (busy) return
    if (shovel) {
      if (plot.cropId) void handleDig(plot)
      return
    }
    if (plot.status === 'empty') openPlant(plot)
    else if (plot.status === 'growing') setInfoPlot(plot)
    else if (plot.status === 'ready' || plot.status === 'withered') void handleHarvest(plot)
  }

  const closeShop = useCallback(() => setShopOpen(false), [])
  const closePlant = useCallback(() => setPlantingPlot(null), [])
  const closeInfo = useCallback(() => setInfoPlot(null), [])

  if (loading) return null

  const shopCrop = shopSelected ? CROPS.find((x) => `seed:${x.id}` === shopSelected) : undefined
  const shopItem = shopCrop
    ? {
        id: `seed:${shopCrop.id}`,
        name: t(`crop.${shopCrop.nameKey}`),
        price: shopCrop.seedPrice,
        extra: shopCrop.tree
          ? t('shopTreeInfo', { days: shopCrop.growDays, regrow: shopCrop.tree.regrowDays, sell: shopCrop.sellPrice }) +
            ` · ${t('orchardOnly')}`
          : t('shopSeedInfo', { days: shopCrop.growDays, sell: shopCrop.sellPrice }) +
            (shopCrop.water ? ` · ${t('pondOnly')}` : '')
      }
    : null

  const infoCrop = infoPlot?.cropId ? getCrop(infoPlot.cropId) : undefined

  const seedGrid = (crops: CropDef[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-x-2 gap-y-3">
      {crops.map((c) => (
        <GameSlot
          key={c.id}
          selected={shopSelected === `seed:${c.id}`}
          badge={inventory[`seed:${c.id}`] || undefined}
          label={<>{c.seedPrice}🪙</>}
          onClick={() => setShopSelected(`seed:${c.id}`)}
        >
          <CropIcon crop={c} alt={t(`crop.${c.nameKey}`)} />
        </GameSlot>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-[800px]">
        <GardenCanvas
          plots={plots}
          balance={balance}
          shovel={shovel}
          keysEnabled={!shopOpen && !plantingPlot && !infoPlot}
          onPlotClick={handlePlotClick}
          onShopClick={() => { setShopSelected(null); setShopOpen(true) }}
        />

        <button
          type="button"
          onClick={() => setShovel((v) => !v)}
          aria-pressed={shovel}
          title={t('shovel')}
          aria-label={t('shovel')}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-sm transition-transform active:scale-95"
          style={{
            background: shovel ? '#f7c96b' : '#f4dfb4',
            boxShadow: shovel ? 'inset 0 0 0 3px #a0643a, 0 0 0 2px #fff3c4' : 'inset 0 0 0 3px #a0643a',
            transform: shovel ? 'translateY(1px)' : undefined
          }}
        >
          <ShovelIcon />
        </button>

        <GameModal
          open={shopOpen}
          onClose={closeShop}
          title={<>{t('shopTitle')} <span className="ml-2 text-xl">{balance}🪙</span></>}
          footer={
            <>
              <span className="mr-auto min-w-0 flex-1 truncate">
                {shopItem ? (
                  <>
                    <b>{shopItem.name}</b> · {shopItem.price}🪙 · {t('owned', { count: inventory[shopItem.id] ?? 0 })}
                    <span className="block text-base opacity-80">{shopItem.extra}</span>
                  </>
                ) : (
                  <span className="opacity-80">{t('shopHint')}</span>
                )}
              </span>
              <GameButton
                disabled={!shopItem || busy || balance < shopItem.price}
                onClick={() => shopItem && handleBuy(shopItem.id, shopItem.name)}
              >
                {t('buy')}
              </GameButton>
            </>
          }
        >
          <GameSectionTitle>{t('seeds')}</GameSectionTitle>
          {seedGrid(LAND_CROPS)}
          <GameSectionTitle>{t('waterPlants')}</GameSectionTitle>
          {seedGrid(WATER_CROPS)}
          {ORCHARD_ENABLED && (
            <>
              <GameSectionTitle>{t('trees')}</GameSectionTitle>
              {seedGrid(TREE_CROPS)}
            </>
          )}
          <p className="mt-3 text-base opacity-80">{t('witherHint', { days: WITHER_AFTER_DAYS })}</p>
        </GameModal>

        <GameModal
          open={!!plantingPlot}
          onClose={closePlant}
          title={plantingKind === 'pond' ? t('plantPond') : plantingKind === 'orchard' ? t('plantOrchard') : t('plant')}
          footer={
            <>
              <GameButton variant="secondary" onClick={closePlant}>{t('cancel')}</GameButton>
              <GameButton onClick={handlePlant} disabled={!selectedCrop || busy}>{t('plant')}</GameButton>
            </>
          }
        >
          <GameSectionTitle>{t('chooseSeed')}</GameSectionTitle>
          {ownedSeeds.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1">
                {plantingKind === 'pond' ? t('noWaterSeedsHint') : plantingKind === 'orchard' ? t('noTreeSeedsHint') : t('noSeedsHint')}
              </p>
              <GameButton variant="secondary" onClick={() => { closePlant(); setShopSelected(null); setShopOpen(true) }}>
                {t('shopTitle')}
              </GameButton>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-x-2 gap-y-3">
              {ownedSeeds.map((c) => (
                <GameSlot
                  key={c.id}
                  selected={selectedCrop === c.id}
                  badge={inventory[`seed:${c.id}`]}
                  label={t(`crop.${c.nameKey}`)}
                  onClick={() => setSelectedCrop(c.id)}
                >
                  <CropIcon crop={c} alt={t(`crop.${c.nameKey}`)} />
                </GameSlot>
              ))}
            </div>
          )}
        </GameModal>

        <GameModal
          open={!!infoPlot && !!infoCrop}
          onClose={closeInfo}
          title={infoCrop ? t(`crop.${infoCrop.nameKey}`) : ''}
          footer={
            <>
              {infoCrop?.tree && infoPlot && (
                <GameButton variant="secondary" disabled={busy} onClick={() => handleRemoveTree(infoPlot)}>
                  {t('removeTree')}
                </GameButton>
              )}
              <GameButton onClick={closeInfo}>{t('close')}</GameButton>
            </>
          }
        >
          {infoPlot && infoCrop?.tree && (
            <div className="flex items-center gap-4">
              <div className="flex h-32 w-24 shrink-0 items-end justify-center">
                <CropSprite
                  crop={infoCrop}
                  frame={growthFrame(infoCrop.stages, infoPlot.status, infoPlot.daysElapsed, infoPlot.growDays, infoPlot.mature)}
                  height={128}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p>{t('infoPlanted', { date: infoPlot.plantedOn ?? '' })}</p>
                {infoPlot.mature ? (
                  <p>{t('infoNextFruit', { days: infoPlot.fruitDaysLeft })}</p>
                ) : (
                  <>
                    <p>{t('infoProgress', { days: infoPlot.daysElapsed, total: infoPlot.growDays })}</p>
                    <p>{t('infoMatures', { days: Math.max(0, infoPlot.growDays - infoPlot.daysElapsed) })}</p>
                  </>
                )}
                <p>{t('infoHarvestValue', { amount: Math.round(infoPlot.sellPrice * (1 + HARVEST_INTEREST)) })}</p>
                <p className="text-base opacity-80">{t('treeHint')}</p>
              </div>
            </div>
          )}
          {infoPlot && infoCrop && !infoCrop.tree && (
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-20 shrink-0 items-end justify-center">
                <CropSprite
                  crop={infoCrop}
                  frame={growthFrame(infoCrop.stages, infoPlot.status, infoPlot.daysElapsed, infoPlot.growDays)}
                  height={infoCrop.stages.h > infoCrop.stages.w ? 96 : 64}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p>{t('infoPlanted', { date: infoPlot.plantedOn ?? '' })}</p>
                <p>{t('infoProgress', { days: infoPlot.daysElapsed, total: infoPlot.growDays })}</p>
                <div className="h-3 w-full" style={{ background: '#e3c48e', boxShadow: 'inset 0 0 0 2px #a0643a' }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, (infoPlot.daysElapsed / Math.max(1, infoPlot.growDays)) * 100)}%`,
                      background: '#6abe30'
                    }}
                  />
                </div>
                <p>{t('infoDaysLeft', { days: Math.max(0, infoPlot.growDays - infoPlot.daysElapsed) })}</p>
                <p>{t('infoHarvestValue', { amount: Math.round(infoPlot.sellPrice * (1 + HARVEST_INTEREST)) })}</p>
                <p className="text-base opacity-80">{t('witherHint', { days: WITHER_AFTER_DAYS })}</p>
              </div>
            </div>
          )}
        </GameModal>
      </div>
      <p className="text-center text-sm text-muted-foreground">{shovel ? t('shovelHint') : t('moveHint')}</p>
      <p className="text-center text-[11px] text-muted-foreground">{t('assetCredit')}</p>
    </div>
  )
}

/** A 16x16 pixel-art shovel, drawn at 2x. */
function ShovelIcon() {
  // [x, y, w, h, colour] in source pixels
  const px: [number, number, number, number, string][] = [
    [11, 1, 4, 1, '#5a3a1b'], [12, 2, 2, 2, '#5a3a1b'],
    [11, 4, 2, 1, '#8b5a2b'], [10, 5, 2, 1, '#8b5a2b'], [9, 6, 2, 1, '#8b5a2b'], [8, 7, 2, 1, '#8b5a2b'],
    [5, 8, 4, 1, '#5d6470'], [4, 9, 5, 1, '#8a919c'], [3, 10, 5, 1, '#8a919c'], [3, 11, 4, 1, '#8a919c'],
    [3, 12, 3, 1, '#5d6470'], [3, 13, 1, 1, '#5d6470'], [5, 9, 1, 2, '#c9ced6']
  ]
  return (
    <svg width={28} height={28} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      {px.map(([x, y, w, h, fill], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />)}
    </svg>
  )
}
