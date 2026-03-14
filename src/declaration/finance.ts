export enum IncomeType {
  Input,
  Checkbox
}

export const IncomeTypeLabel = new Map<IncomeType, string>([
  [IncomeType.Input, 'Input'],
  [IncomeType.Checkbox, 'Checkbox']
])

export interface IncomeDeclaration {
  id?: number
  type?: IncomeType
  name?: string
  amount?: number
}

export interface Income {
  id?: number
  date: Date
  incomeDeclaration?: IncomeDeclaration
  incomeDeclarationId?: number
  quantity?: number
  name?: string
  checked?: boolean
}

export interface Setting {
  incomeRecords: IncomeDeclaration[]
  transactions: Income[]
  lockExpenseIfNotEnough: boolean
  paymentDeadlineDays: number
}

export enum FinanceTab {
  Settings,
  Transactions,
  Statistic
}

export enum TransactionType {
  Income = 'income',
  Expense = 'expense'
}

export const TransactionTypeLabel = new Map<TransactionType, string>([
  [TransactionType.Income, 'Thu'],
  [TransactionType.Expense, 'Chi']
])

export interface FinanceSetting {
  incomes?: IncomeDeclaration[]
  isRounded?: boolean
  isExpenseLocked?: boolean
  paymentDeadlineDays?: number
}

export interface FinanceEvent {
  string?: number
  start?: Date
  title?: string
}
