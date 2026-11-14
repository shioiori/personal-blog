'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { GameButton, GameModal, GameSectionTitle, GameSlot } from './GameUI'
import { CROPS, FERTILIZERS, WITHER_AFTER_DAYS } from '@/src/lib/garden-catalog'
import { GardenCanvas, type GardenPlot } from './GardenCanvas'

export function GardenTab() {
  const t = useTranslations('Planner')
  const [plots, setPlots] = useState<GardenPlot[]>([])
  const [balance, setBalance] = useState(0)
  const [inventory, setInventory] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [plantingPlot, setPlantingPlot] = useState<GardenPlot | null>(null)
  const [selectedCrop, setSelectedCrop] = useState<string>('')
  const [selectedFertilizer, setSelectedFertilizer] = useState<string>('')
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
    setSelectedFertilizer('')
  }

  async function handlePlant() {
    if (!plantingPlot || !selectedCrop) return
    setBusy(true)
    try {
      const res = await fetch('/api/planner/garden/plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plotId: plantingPlot.id,
          cropId: selectedCrop,
          fertilizerId: selectedFertilizer || null
        })
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

  const ownedSeeds = CROPS.filter((c) => (inventory[`seed:${c.id}`] ?? 0) > 0)
  const ownedFertilizers = FERTILIZERS.filter((f) => (inventory[`fert:${f.id}`] ?? 0) > 0)

  function handlePlotClick(plot: GardenPlot) {
    if (busy) return
    if (plot.status === 'empty') openPlant(plot)
    else if (plot.status === 'ready' || plot.status === 'withered') void handleHarvest(plot)
  }

  const closeShop = useCallback(() => setShopOpen(false), [])
  const closePlant = useCallback(() => setPlantingPlot(null), [])

  if (loading) return null


  const pixelImg = { imageRendering: 'pixelated' as const }
  const shopItem = shopSelected
    ? shopSelected.startsWith('seed:')
      ? (() => {
          const c = CROPS.find((x) => `seed:${x.id}` === shopSelected)!
          return { id: shopSelected, name: t(`crop.${c.nameKey}`), price: c.seedPrice, extra: t('shopSeedInfo', { days: c.growDays, sell: c.sellPrice }) }
        })()
      : (() => {
          const f = FERTILIZERS.find((x) => `fert:${x.id}` === shopSelected)!
          return { id: shopSelected, name: t(`fertilizer.${f.nameKey}`), price: f.price, extra: '' }
        })()
    : null

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
                    {shopItem.extra && <span className="block text-base opacity-80">{shopItem.extra}</span>}
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-x-2 gap-y-3">
            {CROPS.map((c) => (
              <GameSlot
                key={c.id}
                selected={shopSelected === `seed:${c.id}`}
                badge={inventory[`seed:${c.id}`] || undefined}
                label={<>{c.seedPrice}🪙</>}
                onClick={() => setShopSelected(`seed:${c.id}`)}
              >
                <Image src={c.seedIcon} alt={t(`crop.${c.nameKey}`)} width={40} height={40} style={pixelImg} />
              </GameSlot>
            ))}
          </div>
          <GameSectionTitle>{t('fertilizers')}</GameSectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-x-2 gap-y-3">
            {FERTILIZERS.map((f) => (
              <GameSlot
                key={f.id}
                selected={shopSelected === `fert:${f.id}`}
                badge={inventory[`fert:${f.id}`] || undefined}
                label={<>{f.price}🪙</>}
                onClick={() => setShopSelected(`fert:${f.id}`)}
              >
                <span className="text-3xl">{f.emoji}</span>
              </GameSlot>
            ))}
          </div>
          <p className="mt-3 text-base opacity-80">{t('witherHint', { days: WITHER_AFTER_DAYS })}</p>
        </GameModal>

        <GameModal
          open={!!plantingPlot}
          onClose={closePlant}
          title={t('plant')}
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
              <p className="flex-1">{t('noSeedsHint')}</p>
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
                  <Image src={c.seedIcon} alt={t(`crop.${c.nameKey}`)} width={40} height={40} style={pixelImg} />
                </GameSlot>
              ))}
            </div>
          )}
          <GameSectionTitle>{t('chooseFertilizer')}</GameSectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-x-2 gap-y-3">
            <GameSlot selected={selectedFertilizer === ''} label={t('none')} onClick={() => setSelectedFertilizer('')}>
              <span className="text-2xl">∅</span>
            </GameSlot>
            {ownedFertilizers.map((f) => (
              <GameSlot
                key={f.id}
                selected={selectedFertilizer === f.id}
                badge={inventory[`fert:${f.id}`]}
                label={t(`fertilizer.${f.nameKey}`)}
                onClick={() => setSelectedFertilizer(f.id)}
              >
                <span className="text-3xl">{f.emoji}</span>
              </GameSlot>
            ))}
          </div>
        </GameModal>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">{t('assetCredit')}</p>
    </div>
  )
}
