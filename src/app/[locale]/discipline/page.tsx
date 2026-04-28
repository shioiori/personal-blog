'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import SettingTab from '@/src/components/discipline/SettingTab'
import TransactionTab from '@/src/components/discipline/TransactionTab'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/src/components/ui/Tabs'
import {
  DisciplineTab,
  DisciplineSettingEntry,
  IncomeDeclaration
} from '@/src/declaration/discipline'
import StatsTab from '@/src/components/discipline/StatsTab'

export default function Page() {
  const t = useTranslations('Discipline')
  const tabs = [
    { key: 'settings', label: t('tabs.settings'), type: DisciplineTab.Settings },
    {
      key: 'transactions',
      label: t('tabs.transactions'),
      type: DisciplineTab.Transactions
    },
    { key: 'statistic', label: t('tabs.statistic'), type: DisciplineTab.Statistic }
  ]

  const [activeTab, setActiveTab] = useState(tabs[0].key)
  const [activeSettingKey, setActiveSettingKey] = useState('')
  const [activeIncomeDeclarations, setActiveIncomeDeclarations] = useState<
    IncomeDeclaration[]
  >([])
  const [activePaymentDeadlineDays, setActivePaymentDeadlineDays] = useState<number | undefined>()
  const [activeIsRounded, setActiveIsRounded] = useState(false)

  function handleActiveKeyChange(
    key: string,
    entry: DisciplineSettingEntry & { id: string }
  ) {
    setActiveSettingKey(key)
    setActiveIncomeDeclarations(entry.incomes ?? [])
    setActivePaymentDeadlineDays(entry.paymentDeadlineDays)
    setActiveIsRounded(entry.isRounded ?? false)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {tabs.map((x) => (
              <TabsTrigger key={x.key} value={x.key}>
                {x.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((x) => (
            <TabsContent value={x.key} key={x.key} className="mt-6">
              {(() => {
                switch (x.type) {
                  case DisciplineTab.Settings:
                    return (
                      <SettingTab onActiveKeyChange={handleActiveKeyChange} />
                    )
                  case DisciplineTab.Transactions:
                    return (
                      <TransactionTab
                        settingKey={activeSettingKey}
                        incomeDeclarations={activeIncomeDeclarations}
                      />
                    )
                  case DisciplineTab.Statistic:
                    return (
                      <StatsTab
                        settingKey={activeSettingKey}
                        incomeDeclarations={activeIncomeDeclarations}
                        paymentDeadlineDays={activePaymentDeadlineDays}
                        isRounded={activeIsRounded}
                      />
                    )
                }
              })()}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
