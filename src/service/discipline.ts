import {
  DisciplineSettingStore,
  IncomeDeclaration,
  Income,
  StoredIncome,
  StoredExpense
} from '@/src/declaration/discipline'

const SETTINGS_KEY = 'discipline_settings'
const INCOMES_KEY = 'discipline_incomes'
const EXPENSES_KEY = 'discipline_expenses'

function readStore(): DisciplineSettingStore {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { activeKey: '', entries: {} }
    return JSON.parse(raw) as DisciplineSettingStore
  } catch {
    return { activeKey: '', entries: {} }
  }
}

function writeStore(store: DisciplineSettingStore): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(store))
}

function readIncomes(): StoredIncome[] {
  try {
    const raw = localStorage.getItem(INCOMES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeIncomes(incomes: StoredIncome[]): void {
  localStorage.setItem(INCOMES_KEY, JSON.stringify(incomes))
}

function readExpenses(): StoredExpense[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeExpenses(expenses: StoredExpense[]): void {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses))
}

function nextId(items: { id: number }[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map((x) => x.id)) + 1
}

export async function getSettingStore(): Promise<DisciplineSettingStore> {
  return readStore()
}

export async function updateSettingKeyLabel(
  key: string,
  label: string
): Promise<DisciplineSettingStore> {
  const store = readStore()
  if (!store.entries[key]) return store
  store.entries[key] = { ...store.entries[key], label }
  writeStore(store)
  return store
}

export async function deleteSettingKey(key: string): Promise<DisciplineSettingStore> {
  const store = readStore()
  delete store.entries[key]
  if (store.activeKey === key) {
    store.activeKey = Object.keys(store.entries)[0] ?? ''
  }
  writeStore(store)

  const incomes = readIncomes().filter((x) => x.settingKey !== key)
  writeIncomes(incomes)

  const expenses = readExpenses().filter((x) => x.settingKey !== key)
  writeExpenses(expenses)

  return store
}

export async function saveSettingKey(
  key: string,
  label: string | undefined
): Promise<void> {
  const store = readStore()

  if (store.entries[key]) {
    store.entries[key] = {
      ...store.entries[key],
      label
    }
  } else {
    store.entries[key] = {
      label,
      incomes: [],
      isExpenseLocked: false,
      isRounded: false
    }
  }

  writeStore(store)
}

export async function saveSettings(
  key: string,
  settings: {
    isExpenseLocked: boolean
    isRounded: boolean
    paymentDeadlineDays: number | undefined
  },
  incomes: IncomeDeclaration[]
): Promise<DisciplineSettingStore> {
  const store = readStore()

  store.activeKey = key

  const existing = store.entries[key] ?? { isPublic: false }
  store.entries[key] = {
    ...existing,
    isExpenseLocked: settings.isExpenseLocked,
    isRounded: settings.isRounded,
    paymentDeadlineDays: settings.paymentDeadlineDays,
    incomes
  }

  writeStore(store)
  return store
}

export async function getIncomes(
  settingKey: string,
  month?: string, // 'YYYY-MM'
  startDate?: string, // 'YYYY-MM-DD'
  endDate?: string // 'YYYY-MM-DD'
): Promise<Income[]> {
  const all = readIncomes().filter((x) => x.settingKey === settingKey)

  let filtered = month ? all.filter((x) => x.date.startsWith(month)) : all

  if (startDate) filtered = filtered.filter((x) => x.date >= startDate)
  if (endDate) filtered = filtered.filter((x) => x.date <= endDate)

  return filtered.map((row) => ({
    id: row.id,
    date: new Date(row.date),
    incomeDeclarationId: row.incomeDeclarationId,
    name: row.name,
    quantity: row.quantity,
    checked: row.checked
  }))
}

export async function addIncome(
  settingKey: string,
  income: Income
): Promise<void> {
  const all = readIncomes()
  all.push({
    id: nextId(all),
    settingKey,
    date: new Date(income.date).toISOString().split('T')[0],
    incomeDeclarationId: income.incomeDeclarationId,
    name: income.name,
    quantity: income.quantity,
    checked: income.checked
  })
  writeIncomes(all)
}

export async function updateIncome(
  settingKey: string,
  id: number,
  income: Partial<Income> & { date: Date }
): Promise<void> {
  const all = readIncomes()
  const index = all.findIndex((x) => x.id === id && x.settingKey === settingKey)
  if (index === -1) return
  all[index] = {
    ...all[index],
    date: new Date(income.date).toISOString().split('T')[0],
    ...(income.incomeDeclarationId !== undefined && { incomeDeclarationId: income.incomeDeclarationId }),
    ...(income.name !== undefined && { name: income.name }),
    ...(income.quantity !== undefined && { quantity: income.quantity }),
    ...(income.checked !== undefined && { checked: income.checked })
  }
  writeIncomes(all)
}

export async function updateExpense(
  settingKey: string,
  id: number,
  expense: Partial<{ date: Date; name: string; amount: number }> & { date: Date }
): Promise<void> {
  const all = readExpenses()
  const index = all.findIndex((x) => x.id === id && x.settingKey === settingKey)
  if (index === -1) return
  all[index] = {
    ...all[index],
    date: new Date(expense.date).toISOString().split('T')[0],
    ...(expense.name !== undefined && { name: expense.name }),
    ...(expense.amount !== undefined && { amount: expense.amount })
  }
  writeExpenses(all)
}

export async function getExpenses(
  settingKey: string,
  month?: string, // 'YYYY-MM'
  startDate?: string, // 'YYYY-MM-DD'
  endDate?: string // 'YYYY-MM-DD'
): Promise<{ id: number; date: Date; name: string; amount: number }[]> {
  const all = readExpenses().filter((x) => x.settingKey === settingKey)

  let filtered = month ? all.filter((x) => x.date.startsWith(month)) : all

  if (startDate) filtered = filtered.filter((x) => x.date.slice(0, 10) >= startDate)
  if (endDate) filtered = filtered.filter((x) => x.date.slice(0, 10) <= endDate)

  return filtered.map((row) => ({
    id: row.id,
    date: new Date(row.date),
    name: row.name,
    amount: row.amount
  }))
}

export async function deleteIncome(settingKey: string, id: number): Promise<void> {
  const all = readIncomes().filter((x) => !(x.id === id && x.settingKey === settingKey))
  writeIncomes(all)
}

export async function deleteExpense(settingKey: string, id: number): Promise<void> {
  const all = readExpenses().filter((x) => !(x.id === id && x.settingKey === settingKey))
  writeExpenses(all)
}

export async function addExpense(
  settingKey: string,
  expense: { date: Date; name: string; amount: number }
): Promise<void> {
  const all = readExpenses()
  all.push({
    id: nextId(all),
    settingKey,
    date: new Date(expense.date).toISOString(),
    name: expense.name,
    amount: expense.amount
  })
  writeExpenses(all)
}
