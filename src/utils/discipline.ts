import { Income, IncomeDeclaration, IncomeType } from '@/src/declaration/discipline'

export function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount)
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('vi-VN')
}

export function calcIncomeAmount(
  income: Income,
  decl?: IncomeDeclaration,
  rounded = false
): number {
  if (!decl) return 0
  let amount = 0
  if (decl.type === IncomeType.Input) {
    amount = (income.quantity ?? 0) * (decl.amount ?? 0)
  } else if (decl.type === IncomeType.Checkbox) {
    amount = income.checked ? (decl.amount ?? 0) : 0
  }
  return rounded ? Math.floor(amount) : amount
}
