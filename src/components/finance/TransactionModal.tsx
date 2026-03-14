'use client'

import { useEffect, useState } from 'react'
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
import { FINANCE_SETTING, FINANCE_TRANSACTION } from '@/src/constants'
import {
  FinanceSetting,
  IncomeType,
  Income,
  TransactionType,
  TransactionTypeLabel
} from '@/src/declaration/finance'
import { Checkbox } from '../ui/Checkbox'
import { emitter } from '@/src/utils/emitter'

export default function TransactionModal({
  showModal,
  closeModal,
  selectedDate
}: {
  showModal: boolean
  closeModal: () => void
  selectedDate: Date
}) {
  const [transactionType, setTransactionType] = useState<TransactionType>(
    TransactionType.Income
  )
  const [income, setIncome] = useState<Income>()
  const [quantity, setQuantity] = useState<number>(1)
  const [expenseName, setExpenseName] = useState<string>('')
  const [expenseAmount, setExpenseAmount] = useState<number>(0)
  const [setting, setSetting] = useState<FinanceSetting>()

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setQuantity(1)
      setExpenseName('')
      setExpenseAmount(0)
      closeModal()
    }
  }

  useEffect(() => {
    const setting = localStorage.getItem(FINANCE_SETTING)
    setSetting(setting ? JSON.parse(setting) : undefined)
  }, [showModal])

  function getTransactionTabs() {
    return (
      <TabsList className="flex">
        {Object.values(TransactionType).map((value) => (
          <TabsTrigger value={value}>
            {' '}
            {TransactionTypeLabel.get(value)}
          </TabsTrigger>
        ))}
      </TabsList>
    )
  }

  function handleAdd() {
    if (transactionType == TransactionType.Income) {
      const data = localStorage.getItem(FINANCE_TRANSACTION)
      const transaction = data
        ? JSON.parse(data)
        : {
            incomes: [],
            expenses: []
          }
      transaction.incomes.push(income)
      localStorage.setItem(FINANCE_TRANSACTION, JSON.stringify(transaction))
      emitter.emit('add-income')
      closeModal()
    }
  }

  return (
    <Dialog open={showModal} onOpenChange={handleOpenChange}>
      <DialogContent className="border border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            Thêm Khoản Thu / Chi
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {selectedDate.toLocaleDateString('vi-VN')}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          onValueChange={(value) =>
            setTransactionType(value as TransactionType)
          }
          className="w-full"
        >
          {getTransactionTabs()}
          <TabsContent value={TransactionType.Income} className="space-y-4">
            <div>
              <Label className="text-foreground">Loại Thu</Label>
              <Select
                onValueChange={(value) => {
                  setIncome({
                    date: new Date(),
                    incomeDeclarationId: Number(value),
                    name: setting?.incomes?.find(
                      (x) => x.id?.toString() == value
                    )?.name
                  })
                }}
              >
                <SelectTrigger className="border border-border bg-input text-foreground">
                  <SelectValue placeholder="Chọn loại thu" />
                </SelectTrigger>

                <SelectContent>
                  {!setting?.incomes || setting.incomes.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Chưa có loại thu nào
                    </SelectItem>
                  ) : (
                    setting.incomes.map((record, index) => (
                      <SelectItem
                        key={index}
                        value={record?.id?.toString() || ''}
                      >
                        {record.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {income?.incomeDeclarationId &&
              setting?.incomes?.find((r) => r.id === income.incomeDeclarationId)
                ?.type === IncomeType.Input && (
                <div>
                  <Label className="text-foreground">Số Lượng</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="border border-border bg-input text-foreground"
                  />
                </div>
              )}

            {income?.incomeDeclarationId &&
              setting?.incomes?.find((r) => r.id === income.incomeDeclarationId)
                ?.type === IncomeType.Checkbox && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    onCheckedChange={(checked: boolean) =>
                      setIncome({ ...income, checked: checked })
                    }
                  />
                  <Label className="text-foreground">Hoàn thành</Label>
                </div>
              )}
          </TabsContent>

          <TabsContent value={TransactionType.Expense} className="space-y-4">
            <div>
              <Label className="text-foreground">Tên Khoản Chi</Label>
              <Input
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                placeholder="e.g., Mua đồ dùng"
                className="border border-border bg-input text-foreground"
              />
            </div>

            <div>
              <Label className="text-foreground">Số Tiền</Label>
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
          >
            Hủy
          </Button>
          <Button
            className="gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={handleAdd}
            disabled={income?.incomeDeclarationId == null}
          >
            Thêm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
