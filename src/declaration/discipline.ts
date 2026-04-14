import type { ReactNode } from 'react'

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

export enum DisciplineTab {
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

export interface DisciplineSetting {
  incomes?: IncomeDeclaration[]
  isRounded?: boolean
  isExpenseLocked?: boolean
  paymentDeadlineDays?: number
}

export interface DisciplineEvent {
  id: string
  start?: Date | string
  title?: string
  color?: string
  extendedProps?: {
    recordId: number
    type: TransactionType
    incomeDeclarationName?: string
    quantity?: number
    checked?: boolean
    amount?: number
  }
}

export interface DisciplineSettingEntry extends DisciplineSetting {
  id?: number
  label?: string
}

export interface DisciplineSettingStore {
  activeKey: string
  entries: Record<string, DisciplineSettingEntry>
}

export interface StoredIncome {
  id: number
  settingKey: string
  date: string
  incomeDeclarationId?: number
  name?: string
  quantity?: number
  checked?: boolean
}

export interface StoredExpense {
  id: number
  settingKey: string
  date: string
  name: string
  amount: number
}

export interface ExpenseRecord {
  id: number
  date: Date
  name: string
  amount: number
}

export interface IncomeRow {
  id: number
  date: Date
  name: string
  amount: number
  incomeDeclarationId?: number
  quantity?: number
  checked?: boolean
}

export type SummaryItem = {
  label: string
  amount: number
  icon: ReactNode
  bg: string
  iconBg: string
  textColor: string
  sign?: string
}
