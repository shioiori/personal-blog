'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogFooter,
  DialogHeader
} from '../ui/Dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import { Label } from '../ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import {
  IncomeDeclaration,
  IncomeType,
  Income,
  TransactionType,
  TransactionTypeLabel
} from '@/src/declaration/discipline'
import { addIncome, addExpense, updateIncome, updateExpense } from '@/src/service/discipline'
import { toast } from 'sonner'

type EditingRecord = {
  id: number
  type: TransactionType
  date: Date
  name: string
  incomeDeclarationId?: number
  quantity?: number
  checked?: boolean
  amount?: number
} | null

export default function TransactionModal({
  showModal,
  closeModal,
  selectedDate,
  settingKey,
  incomeDeclarations,
  editingRecord,
  onTransactionAdded
}: {
  showModal: boolean
  closeModal: () => void
  selectedDate: Date
  settingKey: string
  incomeDeclarations: IncomeDeclaration[]
  editingRecord: EditingRecord
  onTransactionAdded: () => void
}) {
  const isEdit = editingRecord != null
  const t = useTranslations('Discipline.transaction')
  const tType = useTranslations('Discipline.transactionType')

  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.Income)
  const [income, setIncome] = useState<Income>()
  const [quantity, setQuantity] = useState<number>(1)
  const [expenseName, setExpenseName] = useState<string>('')
  const [expenseAmount, setExpenseAmount] = useState<number>(0)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (showModal && editingRecord) {
      setTransactionType(editingRecord.type)
      if (editingRecord.type === TransactionType.Income) {
        setIncome({
          id: editingRecord.id,
          date: editingRecord.date,
          name: editingRecord.name,
          incomeDeclarationId: editingRecord.incomeDeclarationId,
          quantity: editingRecord.quantity,
          checked: editingRecord.checked
        })
        setQuantity(editingRecord.quantity ?? 1)
      } else {
        setExpenseName(editingRecord.name)
        setExpenseAmount(editingRecord.amount ?? 0)
      }
    } else if (showModal && !editingRecord) {
      setTransactionType(TransactionType.Income)
      setIncome(undefined)
      setQuantity(1)
      setExpenseName('')
      setExpenseAmount(0)
    }
  }, [showModal, editingRecord])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setQuantity(1)
      setExpenseName('')
      setExpenseAmount(0)
      setIncome(undefined)
      closeModal()
    }
  }

  function getTransactionTabs() {
    return (
      <TabsList className="flex">
        {Object.values(TransactionType).map((value) => (
          <TabsTrigger key={value} value={value} disabled={isEdit && value !== transactionType}>
            {tType(value)}
          </TabsTrigger>
        ))}
      </TabsList>
    )
  }

  function handleAdd() {
    if (!settingKey) return

    startTransition(async () => {
      try {
        if (transactionType === TransactionType.Income) {
          if (!income) return
          const isCheckbox = incomeDeclarations.find((r) => r.id === income.incomeDeclarationId)?.type === IncomeType.Checkbox
          if (isEdit) {
            await updateIncome(settingKey, editingRecord!.id, {
              ...income,
              date: selectedDate,
              quantity,
              ...(isCheckbox && { checked: true })
            })
          } else {
            await addIncome(settingKey, {
              ...income,
              date: selectedDate,
              quantity,
              ...(isCheckbox && { checked: true })
            })
          }
        } else {
          if (!expenseName || !expenseAmount) return
          if (isEdit) {
            await updateExpense(settingKey, editingRecord!.id, {
              date: selectedDate,
              name: expenseName,
              amount: expenseAmount
            })
          } else {
            await addExpense(settingKey, {
              date: selectedDate,
              name: expenseName,
              amount: expenseAmount
            })
          }
        }
        onTransactionAdded()
        handleOpenChange(false)
        toast.success(isEdit ? t('updateSuccess') : t('addSuccess'))
      } catch {
        toast.error(isEdit ? t('updateError') : t('addError'))
      }
    })
  }

  const canSubmit =
    transactionType === TransactionType.Income
      ? income?.incomeDeclarationId != null
      : expenseName.trim() !== '' && expenseAmount > 0

  return (
    <Dialog open={showModal} onOpenChange={handleOpenChange}>
      <DialogContent className="border border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            {isEdit ? t('editTitle') : t('addTitle')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {selectedDate.toLocaleDateString('vi-VN')}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={transactionType}
          onValueChange={(value) => setTransactionType(value as TransactionType)}
          className="w-full"
        >
          {getTransactionTabs()}
          <TabsContent value={TransactionType.Income} className="space-y-4">
            <div>
              <Label className="text-foreground">{t('incomeType')}</Label>
              <Select
                value={income?.incomeDeclarationId?.toString()}
                onValueChange={(value) => {
                  setIncome({
                    ...income,
                    date: selectedDate,
                    incomeDeclarationId: Number(value),
                    name: incomeDeclarations.find((x) => x.id?.toString() == value)?.name
                  })
                }}
              >
                <SelectTrigger className="border border-border bg-input text-foreground">
                  <SelectValue placeholder={t('selectIncomePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {incomeDeclarations.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      {t('noIncomeTypes')}
                    </SelectItem>
                  ) : (
                    incomeDeclarations.map((record, index) => (
                      <SelectItem key={index} value={record?.id?.toString() || ''}>
                        {record.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {income?.incomeDeclarationId &&
              incomeDeclarations.find((r) => r.id === income.incomeDeclarationId)?.type === IncomeType.Input && (
                <div>
                  <Label className="text-foreground">{t('quantity')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="border border-border bg-input text-foreground"
                  />
                </div>
              )}

          </TabsContent>

          <TabsContent value={TransactionType.Expense} className="space-y-4">
            <div>
              <Label className="text-foreground">{t('expenseName')}</Label>
              <Input
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                placeholder={t('expenseNamePlaceholder')}
                className="border border-border bg-input text-foreground"
              />
            </div>

            <div>
              <Label className="text-foreground">{t('amount')}</Label>
              <Input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(Number(e.target.value))}
                placeholder="0"
                className="border border-border bg-input text-foreground"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            onClick={closeModal}
            variant="outline"
            className="border border-border text-foreground hover:bg-secondary bg-transparent"
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            className="gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={handleAdd}
            disabled={!canSubmit || isPending}
          >
            {isPending ? (isEdit ? t('updating') : t('adding')) : (isEdit ? t('update') : t('add'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
