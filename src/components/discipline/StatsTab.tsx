'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Search,
  Wallet
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Button } from '../ui/Button'
import {
  IncomeDeclaration,
  IncomeType,
  ExpenseRecord,
  IncomeRow,
  SummaryItem
} from '@/src/declaration/discipline'
import { getIncomes, getExpenses } from '@/src/service/discipline'
import {
  toDateStr,
  formatCurrency,
  formatDate,
  calcIncomeAmount
} from '@/src/utils/discipline'

function SummaryBar({ items }: { items: SummaryItem[] }) {
  return (
    <div className="flex gap-4">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex flex-1 items-center gap-3 overflow-hidden rounded-xl ${item.bg} py-4 pl-5 pr-4`}
        >
          <div className={`rounded-lg p-2 ${item.iconBg}`}>{item.icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-lg font-bold ${item.textColor}`}>
              {item.sign}
              {formatCurrency(item.amount)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function StatsTab({
  settingKey,
  incomeDeclarations,
  paymentDeadlineDays,
  isRounded = false
}: {
  settingKey: string
  incomeDeclarations: IncomeDeclaration[]
  paymentDeadlineDays?: number
  isRounded?: boolean
}) {
  const t = useTranslations('Discipline.stats')
  const today = toDateStr(new Date())

  const [startDate, setStartDate] = useState(today.slice(0, 7) + '-01')
  const [endDate, setEndDate] = useState('')
  const [, startTransition] = useTransition()

  const [rangeIncomes, setRangeIncomes] = useState<IncomeRow[]>([])
  const [rangeExpenses, setRangeExpenses] = useState<ExpenseRecord[]>([])
  const [showIncomes, setShowIncomes] = useState(true)
  const [showExpenses, setShowExpenses] = useState(true)
  const [hasFiltered, setHasFiltered] = useState(false)

  const [allIncomeTotal, setAllIncomeTotal] = useState(0)
  const [allExpenseTotal, setAllExpenseTotal] = useState(0)

  const [pendingIncomes, setPendingIncomes] = useState<IncomeRow[]>([])
  const [overdueIncomes, setOverdueIncomes] = useState<IncomeRow[]>([])

  function loadAllTime() {
    if (!settingKey) return
    startTransition(async () => {
      const [allInc, allExp] = await Promise.all([
        getIncomes(settingKey),
        getExpenses(settingKey)
      ])

      const allIncTotal = allInc.reduce((sum, inc) => {
        const decl = incomeDeclarations.find(
          (d) => d.id === inc.incomeDeclarationId
        )
        return sum + calcIncomeAmount(inc, decl, isRounded)
      }, 0)
      setAllIncomeTotal(allIncTotal)
      setAllExpenseTotal(allExp.reduce((s, e) => s + e.amount, 0))

      const deadlineDays = paymentDeadlineDays ?? 0
      const pending: IncomeRow[] = []
      const overdue: IncomeRow[] = []

      allInc.forEach((inc) => {
        const decl = incomeDeclarations.find(
          (d) => d.id === inc.incomeDeclarationId
        )
        if (!decl) return

        const isIncomplete =
          (decl.type === IncomeType.Checkbox && !inc.checked) ||
          (decl.type === IncomeType.Input && (inc.quantity ?? 0) === 0)

        if (!isIncomplete) return

        const incDate = new Date(inc.date)
        const deadline = new Date(incDate)
        deadline.setDate(deadline.getDate() + deadlineDays)
        const deadlineStr = toDateStr(deadline)

        const row: IncomeRow = {
          id: inc.id!,
          date: inc.date,
          name: decl.name ?? '—',
          amount: decl.amount ?? 0,
          quantity: inc.quantity,
          checked: inc.checked
        }

        if (deadlineStr < today) {
          overdue.push(row)
        } else {
          pending.push(row)
        }
      })

      setPendingIncomes(pending)
      setOverdueIncomes(overdue)
    })
  }

  function handleFilter() {
    if (!settingKey) {
      setRangeIncomes([])
      setRangeExpenses([])
      setHasFiltered(true)
      return
    }
    startTransition(async () => {
      const effectiveEnd = endDate || today

      const [incRaw, expRaw] = await Promise.all([
        getIncomes(settingKey, undefined, startDate, effectiveEnd),
        getExpenses(settingKey, undefined, startDate, effectiveEnd)
      ])

      const incRows: IncomeRow[] = incRaw.map((inc) => {
        const decl = incomeDeclarations.find(
          (d) => d.id === inc.incomeDeclarationId
        )
        return {
          id: inc.id!,
          date: inc.date,
          name: decl?.name ?? inc.name ?? '—',
          amount: calcIncomeAmount(inc, decl, isRounded),
          incomeDeclarationId: inc.incomeDeclarationId,
          quantity: inc.quantity,
          checked: inc.checked
        }
      })
      setRangeIncomes(incRows)
      setRangeExpenses(
        expRaw.map((e) => ({
          id: e.id,
          date: e.date,
          name: e.name,
          amount: e.amount
        }))
      )
      setHasFiltered(true)
    })
  }

  useEffect(() => {
    loadAllTime()
  }, [settingKey, incomeDeclarations, paymentDeadlineDays])

  const rangeTotalIncome = rangeIncomes.reduce((s, r) => s + r.amount, 0)
  const rangeTotalExpense = rangeExpenses.reduce((s, r) => s + r.amount, 0)
  const rangeBalance = rangeTotalIncome - rangeTotalExpense

  const allBalance = allIncomeTotal - allExpenseTotal

  function makeSummaryItems(
    income: number,
    expense: number,
    balance: number
  ): SummaryItem[] {
    const positive = balance >= 0
    return [
      {
        label: t('totalIncome'),
        amount: income,
        icon: <TrendingUp className="h-4 w-4 text-success" />,
        bg: 'bg-muted',
        iconBg: 'bg-success/20',
        textColor: 'text-success'
      },
      {
        label: t('totalExpense'),
        amount: expense,
        icon: <TrendingDown className="h-4 w-4 text-destructive" />,
        bg: 'bg-destructive/10',
        iconBg: 'bg-destructive/20',
        textColor: 'text-destructive'
      },
      {
        label: t('balance'),
        amount: Math.abs(balance),
        icon: (
          <Wallet
            className={`h-4 w-4 ${positive ? 'text-success' : 'text-destructive'}`}
          />
        ),
        bg: 'bg-muted',
        iconBg: positive ? 'bg-success/20' : 'bg-destructive/20',
        textColor: positive ? 'text-success' : 'text-destructive',
        sign: positive ? '+' : '-'
      }
    ]
  }

  const visibleRows = [
    ...(showIncomes
      ? rangeIncomes.map((r) => ({ ...r, type: 'income' as const }))
      : []),
    ...(showExpenses
      ? rangeExpenses.map((r) => ({ ...r, type: 'expense' as const }))
      : [])
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="space-y-6">
      <SummaryBar
        items={makeSummaryItems(allIncomeTotal, allExpenseTotal, allBalance)}
      />

      <Card className="border border-border bg-card p-6">
        <div className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">
            {t('rangeTitle')}
          </h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-muted-foreground">
                {t('from')} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-muted-foreground">{t('to')}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-44"
              />
            </div>
            {endDate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEndDate('')}
              >
                {t('clear')}
              </Button>
            )}
            <Button size="sm" onClick={handleFilter} className="gap-1">
              <Search className="h-4 w-4" />
              {t('filter')}
            </Button>
          </div>
        </div>

        {hasFiltered ? (
          rangeIncomes.length === 0 && rangeExpenses.length === 0 ? (
            <p className="my-4 text-sm text-muted-foreground">
              {t('noTransactions')}
            </p>
          ) : (
          <div className="space-y-6 my-4">
            <SummaryBar
              items={makeSummaryItems(
                rangeTotalIncome,
                rangeTotalExpense,
                rangeBalance
              )}
            />
            <div>
              <div className="mb-3 flex items-center justify-end">
                <div className="flex gap-2">
                  <Button
                    variant={showIncomes ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowIncomes((v) => !v)}
                    className="gap-1"
                  >
                    {showIncomes ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                    {t('income')}
                  </Button>
                  <Button
                    variant={showExpenses ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowExpenses((v) => !v)}
                    className="gap-1"
                  >
                    {showExpenses ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                    {t('expense')}
                  </Button>
                </div>
              </div>

              {visibleRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('noTransactions')}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 text-left font-medium">{t('type')}</th>
                      <th className="pb-2 text-left font-medium">{t('name')}</th>
                      <th className="pb-2 text-left font-medium">{t('date')}</th>
                      <th className="pb-2 text-right font-medium">{t('amountHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => {
                      const isIncome = r.type === 'income'
                      return (
                        <tr
                          key={`${r.type}-${r.id}`}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2.5 pr-3">
                            <div
                              className={`inline-flex rounded-md p-1.5 ${isIncome ? 'bg-success/15' : 'bg-destructive/15'}`}
                            >
                              {isIncome ? (
                                <TrendingUp className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-card-foreground">
                            {r.name}
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">
                            {formatDate(r.date)}
                          </td>
                          <td
                            className={`py-2.5 text-right font-semibold ${isIncome ? 'text-success' : 'text-destructive'}`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatCurrency(r.amount)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('filterHint')}
          </p>
        )}
      </Card>

      {overdueIncomes.length > 0 && (
        <Card className="border border-destructive bg-destructive/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">
              {t('overdue')} ({overdueIncomes.length})
            </h2>
          </div>
          <div className="space-y-2">
            {overdueIncomes.map((r) => (
              <div
                key={`overdue-${r.id}`}
                className="flex items-center justify-between rounded-lg border border-destructive/30 bg-background p-3"
              >
                <div>
                  <p className="font-medium text-card-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.date)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-destructive">
                  {formatCurrency(r.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pendingIncomes.length > 0 && (
        <Card className="border border-warning bg-warning/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-warning">
              {t('pending')} ({pendingIncomes.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pendingIncomes.map((r) => (
              <div
                key={`pending-${r.id}`}
                className="flex items-center justify-between rounded-lg border border-warning/30 bg-background p-3"
              >
                <div>
                  <p className="font-medium text-card-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.date)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-warning">
                  {formatCurrency(r.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
