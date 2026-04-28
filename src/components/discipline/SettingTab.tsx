'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Trash2, SquarePen, RotateCcw, SaveIcon, ChevronDown, KeyRound, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/Collapsible'
import {
  DisciplineSettingEntry,
  DisciplineSettingStore,
  IncomeDeclaration,
  IncomeType,
  IncomeTypeLabel
} from '@/src/declaration/discipline'
import { getSettingStore, saveSettingKey, saveSettings, updateSettingKeyLabel, deleteSettingKey } from '@/src/service/discipline'

export default function SettingTab({
  onActiveKeyChange
}: {
  onActiveKeyChange?: (key: string, entry: DisciplineSettingEntry & { id: string }) => void
}) {
  const t = useTranslations('Discipline.settings')
  const defaultData = { type: IncomeType.Input }

  const [data, setData] = useState<IncomeDeclaration[]>([defaultData])
  const [isExpenseLocked, setIsExpenseLocked] = useState<boolean>(false)
  const [isRounded, setIsRounded] = useState<boolean>(false)
  const [paymentDeadlineDays, setPaymentDeadlineDays] = useState<number | undefined>()
  const [previousData, setPreviousData] = useState<IncomeDeclaration[]>()

  const [settingStore, setSettingStore] = useState<DisciplineSettingStore>({ activeKey: '', entries: {} })
  const [currentKey, setCurrentKey] = useState('')
  const [isAddKeyOpen, setIsAddKeyOpen] = useState(false)
  const [isCurrentSettingOpen, setIsCurrentSettingOpen] = useState(false)
  const [isEditKeyOpen, setIsEditKeyOpen] = useState(false)
  const [newKeyInput, setNewKeyInput] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [currentKeyError, setCurrentKeyError] = useState('')
  const [isPending, startTransition] = useTransition()

  const [editKeySelected, setEditKeySelected] = useState('')
  const [editKeyLabel, setEditKeyLabel] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function loadSettingFromKey(key: string, store: DisciplineSettingStore) {
    const entry = store.entries[key]
    if (!entry) return
    setPreviousData(entry.incomes)
    setIsExpenseLocked(entry.isExpenseLocked ?? false)
    setIsRounded(entry.isRounded ?? false)
    setPaymentDeadlineDays(entry.paymentDeadlineDays)
    setData([defaultData])
  }

  function handleInsertAfter(index: number) {
    setData((prev) => [
      ...prev.slice(0, index + 1),
      defaultData,
      ...prev.slice(index + 1)
    ])
  }

  function handleDeleteRecord(index: number) {
    if (data.length <= 1) return
    setData((prev) => prev.filter((_, i) => i !== index))
  }

  function handleEditPreviousData(index: number) {
    if (previousData?.[index]) setData([...data, previousData[index]])
    setPreviousData((prev) => prev?.filter((_, i) => i !== index))
  }

  function resetToPreviousData() {
    if (currentKey) {
      loadSettingFromKey(currentKey, settingStore)
    } else {
      setPreviousData(undefined)
      setIsExpenseLocked(false)
      setIsRounded(false)
      setPaymentDeadlineDays(undefined)
      setData([defaultData])
    }
  }

  function getIncomeDeclarationType() {
    return (
      <SelectContent>
        {Object.values(IncomeType)
          .filter((x) => !isNaN(Number(x)))
          .map((value) => (
            <SelectItem key={value} value={value.toString()}>
              {IncomeTypeLabel.get(value as IncomeType)}
            </SelectItem>
          ))}
      </SelectContent>
    )
  }

  function handleSave() {
    if (!currentKey) return
    if (!settingStore.entries[currentKey]) {
      setCurrentKeyError(t('keyNotFound').replace('{{key}}', currentKey))
      return
    }
    setCurrentKeyError('')
    const currentData = [...(previousData || []), ...data]
      .filter((x) => x.name && x.amount)
      .map((item, index) => ({ ...item, id: index + 1 }))

    startTransition(async () => {
      try {
        const updatedStore = await saveSettings(
          currentKey,
          { isExpenseLocked, isRounded, paymentDeadlineDays },
          currentData
        )
        setSettingStore(updatedStore)
        setPreviousData(currentData)
        setData([defaultData])
        toast.success(t('saveSuccess'))

        const updatedEntry = updatedStore.entries[currentKey]
        if (updatedEntry && onActiveKeyChange) {
          onActiveKeyChange(currentKey, updatedEntry as DisciplineSettingEntry & { id: string })
        }
      } catch {
        toast.error(t('saveError'))
      }
    })
  }

  function handleSaveNewKey() {
    const trimmed = newKeyInput.trim()
    if (!trimmed) return

    startTransition(async () => {
      try {
        await saveSettingKey(trimmed, newKeyLabel || undefined)
        const updatedStore = await getSettingStore()
        setSettingStore(updatedStore)
        setCurrentKey(trimmed)
        setNewKeyInput('')
        setNewKeyLabel('')
        setIsAddKeyOpen(false)
        toast.success(t('saveKeySuccess'))
      } catch {
        toast.error(t('saveKeyError'))
      }
    })
  }

  function handleGenerateKey() {
    setNewKeyInput(crypto.randomUUID())
  }

  function handleEditKeySelect(key: string) {
    setEditKeySelected(key)
    setEditKeyLabel(settingStore.entries[key]?.label || '')
  }

  function handleSaveEditKeyLabel() {
    if (!editKeySelected) return
    startTransition(async () => {
      try {
        const updatedStore = await updateSettingKeyLabel(editKeySelected, editKeyLabel)
        setSettingStore(updatedStore)
        toast.success(t('saveKeySuccess'))
      } catch {
        toast.error(t('saveKeyError'))
      }
    })
  }

  function handleDeleteKey() {
    if (!editKeySelected) return
    startTransition(async () => {
      try {
        const updatedStore = await deleteSettingKey(editKeySelected)
        setSettingStore(updatedStore)
        setShowDeleteConfirm(false)
        if (currentKey === editKeySelected) {
          const nextKey = Object.keys(updatedStore.entries)[0] ?? ''
          setCurrentKey(nextKey)
          if (nextKey) loadSettingFromKey(nextKey, updatedStore)
          else {
            setPreviousData(undefined)
            setData([defaultData])
          }
        }
        setEditKeySelected('')
        setEditKeyLabel('')
        toast.success(t('deleteKeySuccess'))
      } catch {
        toast.error(t('deleteKeyError'))
      }
    })
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        const store = await getSettingStore()
        setSettingStore(store)
        if (store.activeKey) {
          setCurrentKey(store.activeKey)
          loadSettingFromKey(store.activeKey, store)

          const activeEntry = store.entries[store.activeKey]
          if (activeEntry && onActiveKeyChange) {
            onActiveKeyChange(store.activeKey, activeEntry as DisciplineSettingEntry & { id: string })
          }
        } else {
          setData([defaultData])
        }
      } catch {
        // not authenticated — page handles this
      }
    })
  }, [])

  const allKeys = Object.entries(settingStore.entries)

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card p-6">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-card-foreground">
            {t('title')}
          </h2>
        </div>

        {/* Add Setting Key collapsible */}
        <Collapsible open={isAddKeyOpen} onOpenChange={setIsAddKeyOpen} className="mb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex w-full items-center justify-start gap-2 px-0 text-foreground hover:bg-transparent">
              <KeyRound className="h-4 w-4 text-primary" />
              <span className="font-medium">{t('addKey')}</span>
              <ChevronDown
                className={`ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 ${isAddKeyOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('keyPlaceholder')}
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateKey}
              >
                {t('generateKey')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('labelPlaceholder')}
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSaveNewKey}
                disabled={!newKeyInput.trim() || isPending}
              >
                {t('save')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Edit Setting Key collapsible */}
        <Collapsible open={isEditKeyOpen} onOpenChange={setIsEditKeyOpen} className="mb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex w-full items-center justify-start gap-2 px-0 text-foreground hover:bg-transparent">
              <SquarePen className="h-4 w-4 text-primary" />
              <span className="font-medium">{t('editKey')}</span>
              <ChevronDown
                className={`ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 ${isEditKeyOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <Select value={editKeySelected} onValueChange={handleEditKeySelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectKeyPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {allKeys.length === 0 ? (
                  <SelectItem value="__empty__" disabled>{t('noKeys')}</SelectItem>
                ) : (
                  allKeys.map(([key, entry]) => (
                    <SelectItem key={key} value={key}>{entry.label || key}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {editKeySelected && (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('labelPlaceholder')}
                    value={editKeyLabel}
                    onChange={(e) => setEditKeyLabel(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleSaveEditKeyLabel} disabled={isPending}>
                    {t('save')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Delete confirm modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold text-card-foreground">{t('deleteKeyConfirmTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('deleteKeyConfirmDesc')}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isPending}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteKey}
                  disabled={isPending}
                >
                  {isPending ? t('deleting') : t('confirmDelete')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Current Setting collapsible */}
        <Collapsible open={isCurrentSettingOpen} onOpenChange={setIsCurrentSettingOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex w-full items-center justify-start gap-2 px-0 text-foreground hover:bg-transparent">
              <Settings2 className="h-4 w-4 text-primary" />
              <span className="font-medium">{t('currentSetting')}</span>
              <ChevronDown
                className={`ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 ${isCurrentSettingOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            {/* Key selector */}
            <div className="space-y-1">
              <Select
                value={currentKey}
                onValueChange={(value) => {
                  setCurrentKey(value)
                  setCurrentKeyError('')
                  loadSettingFromKey(value, settingStore)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectKeyPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allKeys.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      {t('noKeys')}
                    </SelectItem>
                  ) : (
                    allKeys.map(([key, entry]) => (
                      <SelectItem key={key} value={key}>
                        {entry.label || key}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {currentKeyError && (
                <p className="text-xs text-destructive">{currentKeyError}</p>
              )}
            </div>

            {/* Income list */}
            <div className="space-y-4">
              {previousData && previousData.length > 0 && (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">{t('incomeNameHeader')}</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">{t('typeHeader')}</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">{t('valueHeader')}</th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground"></th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {previousData?.map((record, index) => (
                      <tr key={index} className="border-b border-border hover:bg-background/50">
                        <td className="py-3 px-4 text-foreground">{record.name}</td>
                        <td className="py-3 px-4 text-foreground">{IncomeTypeLabel.get(record.type as IncomeType)}</td>
                        <td className="py-3 px-4 text-foreground">{record.amount}</td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:bg-primary/10"
                            onClick={() => handleEditPreviousData(index)}
                          >
                            <SquarePen className="h-4 w-4" />
                          </Button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setPreviousData((prev) => prev?.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="rounded-lg border border-dashed border-border bg-background p-4 space-y-2">
                {data.map((x, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <Select
                        value={x.type?.toString()}
                        onValueChange={(value) => {
                          setData((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, type: Number(value) as IncomeType } : item
                            )
                          )
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        {getIncomeDeclarationType()}
                      </Select>
                    </div>

                    <div className="flex-1">
                      <Input
                        placeholder={t('incomePlaceholder')}
                        value={x.name || ''}
                        onChange={(e) => {
                          setData((prev) =>
                            prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item)
                          )
                        }}
                      />
                    </div>

                    <div className="w-32 shrink-0">
                      <Input
                        type="number"
                        placeholder="ex: 20000"
                        value={x.amount || ''}
                        onChange={(e) => {
                          setData((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, amount: Number(e.target.value) } : item
                            )
                          )
                        }}
                      />
                    </div>

                    <div className="flex shrink-0">
                      <Button
                        onClick={() => handleDeleteRecord(index)}
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                      <Button
                        onClick={() => handleInsertAfter(index)}
                        variant="ghost"
                        size="icon"
                        className="text-primary hover:bg-primary/10"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional settings */}
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="expense-locked"
                  checked={isExpenseLocked}
                  onCheckedChange={(checked: boolean) => setIsExpenseLocked(checked)}
                />
                <Label htmlFor="expense-locked" className="cursor-pointer flex-1 text-foreground">
                  {t('lockExpense')}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-rounded"
                  checked={isRounded}
                  onCheckedChange={(checked: boolean) => setIsRounded(checked)}
                />
                <Label htmlFor="is-rounded" className="cursor-pointer flex-1 text-foreground">
                  {t('roundValues')}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-foreground whitespace-nowrap">
                  {t('paymentDeadline')}
                </Label>
                <Input
                  type="number"
                  value={paymentDeadlineDays ?? ''}
                  onChange={(e) => setPaymentDeadlineDays(Number(e.target.value))}
                  min="0"
                  className="flex-1 border border-border"
                />
              </div>
            </div>

            {/* Restore / Save */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={resetToPreviousData}
                variant="outline"
                className="flex-1 gap-2"
                disabled={isPending}
              >
                <RotateCcw className="h-4 w-4" />
                {t('restore')}
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 gap-2"
                disabled={!currentKey || isPending}
              >
                <SaveIcon className="h-4 w-4" />
                {isPending ? t('saving') : t('save')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
