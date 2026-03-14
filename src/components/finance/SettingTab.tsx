'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Trash2, SquarePen, RotateCcw, SaveIcon } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Label } from '@radix-ui/react-dropdown-menu'
import { Input } from '../ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/Select'
import { Checkbox } from '../ui/Checkbox'
import {
  FinanceSetting,
  IncomeDeclaration,
  IncomeType,
  IncomeTypeLabel
} from '@/src/declaration/finance'
import { FINANCE_SETTING } from '@/src/constants'

export default function SettingTab() {
  const defaultData = { type: IncomeType.Input }

  const [data, setData] = useState<IncomeDeclaration[]>([])
  const [isExpenseLocked, setIsExpenseLocked] = useState<boolean>()
  const [isRounded, setIsRounded] = useState<boolean>()
  const [paymentDeadlineDays, setPaymentDeadlineDays] = useState<number>()
  const [previousData, setPreviousData] = useState<IncomeDeclaration[]>()

  function handleAddRecord() {
    setData([...data, defaultData])
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
    const setting =
      JSON.parse(localStorage.getItem(FINANCE_SETTING) as string) ||
      ({} as FinanceSetting)
    setPreviousData(setting.incomes)
    setIsExpenseLocked(setting.isExpenseLocked)
    setIsRounded(setting.isRounded)
    setPaymentDeadlineDays(setting.paymentDeadlineDays)
    setData([defaultData])
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
    const currentData = [...(previousData || []), ...data]
      .filter((x) => x.name && x.amount)
      .map((item, index) => ({
        ...item,
        id: index + 1
      }))
    localStorage.setItem(
      FINANCE_SETTING,
      JSON.stringify({
        isExpenseLocked,
        isRounded,
        paymentDeadlineDays,
        incomes: currentData
      })
    )
    setPreviousData(currentData)
    setData([defaultData])
  }

  useEffect(() => {
    resetToPreviousData()
  }, [])

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-card-foreground">
            Danh Sách Khoản Thu
          </h2>
          <div className="flex">
            <Button
              onClick={resetToPreviousData}
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-primary/10"
              title="Quay về trạng thái ban đầu"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleSave}
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-primary/10"
              title="Lưu"
            >
              <SaveIcon className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleAddRecord}
              variant="ghost"
              size="icon"
              className="text-primary hover:bg-primary/10"
              title="Thêm khoản thu mới"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {previousData && previousData.length > 0 && (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">
                    Tên khoản thu
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">
                    Loại
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">
                    Giá trị thu được
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-foreground"></th>
                  <th className="text-center py-3 px-4 font-semibold text-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {previousData?.map((record, index) => (
                  <tr
                    key={index}
                    className="border-b border-border hover:bg-background/50"
                  >
                    <td className="py-3 px-4 text-foreground">{record.name}</td>
                    <td className="py-3 px-4 text-foreground">
                      {IncomeTypeLabel.get(record.type as IncomeType)}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {record.amount}
                    </td>
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
                        onClick={() =>
                          setPreviousData((prev) =>
                            prev?.filter((_, i) => i !== index)
                          )
                        }
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
              <div key={index} className="grid grid-cols-12 gap-2">
                <div className="col-span-2">
                  <Select
                    value={x.type?.toString()}
                    onValueChange={(value) => {
                      setData((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, type: Number(value) as IncomeType }
                            : item
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

                <div className="col-span-6">
                  <Input
                    placeholder="ex: Lương tháng"
                    value={x.name || ''}
                    onChange={(e) => {
                      setData((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, name: e.target.value } : item
                        )
                      )
                    }}
                  />
                </div>

                <div className="col-span-3">
                  <Input
                    type="number"
                    placeholder="ex: 20000"
                    value={x.amount || ''}
                    onChange={(e) => {
                      setData((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, amount: Number(e.target.value) }
                            : item
                        )
                      )
                    }}
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    onClick={(e) => handleDeleteRecord(index)}
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    title="Thêm khoản thu mới"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4 border-t border-border pt-6">
          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              onCheckedChange={(checked: boolean) =>
                setIsExpenseLocked(checked)
              }
            />
            <Label className="cursor-pointer flex-1 text-foreground">
              Khóa chi nếu không thu đủ khi đến thời hạn
            </Label>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              onCheckedChange={(checked: boolean) => setIsRounded(checked)}
            />
            <Label className="cursor-pointer flex-1 text-foreground">
              Làm tròn đến hàng đơn vị
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Label className="mb-2 block text-foreground whitespace-nowrap">
              Thời Hạn Thanh Toán (tính theo ngày)
            </Label>
            <Input
              type="number"
              value={paymentDeadlineDays}
              onChange={(e) => setPaymentDeadlineDays(Number(e.target.value))}
              min="0"
              className="flex-1 border border-border"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
