'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { GameButton, GameModal, GameSectionTitle, GameSlot } from './GameUI'
import { CROPS, HARVEST_INTEREST, WITHER_AFTER_DAYS, getCrop, growthFrame, type CropDef } from '@/src/lib/garden-catalog'
import { GardenCanvas, type GardenPlot } from './GardenCanvas'
import { CropIcon, CropSprite } from './CropSprite'

const LAND_CROPS = CROPS.filter((c) => !c.water)
const WATER_CROPS = CROPS.filter((c) => c.water)

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

  // A pond plot takes only water plants, a soil plot only land crops.
  const plantingWater = plantingPlot?.kind === 'pond'
  const ownedSeeds = CROPS.filter((c) => !!c.water === plantingWater && (inventory[`seed:${c.id}`] ?? 0) > 0)

  function handlePlotClick(plot: GardenPlot) {
    if (busy) return
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
        extra:
          t('shopSeedInfo', { days: shopCrop.growDays, sell: shopCrop.sellPrice }) +
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
          onPlotClick={handlePlotClick}
          onShopClick={() => { setShopSelected(null); setShopOpen(true) }}
        />

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
          <p className="mt-3 text-base opacity-80">{t('witherHint', { days: WITHER_AFTER_DAYS })}</p>
        </GameModal>

        <GameModal
          open={!!plantingPlot}
          onClose={closePlant}
          title={plantingWater ? t('plantPond') : t('plant')}
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
              <p className="flex-1">{plantingWater ? t('noWaterSeedsHint') : t('noSeedsHint')}</p>
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
          footer={<GameButton onClick={closeInfo}>{t('close')}</GameButton>}
        >
          {infoPlot && infoCrop && (
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-20 shrink-0 items-end justify-center">
                <CropSprite
                  crop={infoCrop}
                  frame={growthFrame(infoCrop.stages, infoPlot.status, infoPlot.daysElapsed, infoPlot.growDays)}
                  height={infoCrop.stages.h >= 32 ? 96 : 64}
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
      <p className="text-center text-[11px] text-muted-foreground">{t('assetCredit')}</p>
    </div>
  )
}
