'use client'

import { useState } from 'react'
import SettingTab from '@/src/components/finance/SettingTab'
import TransactionTab from '@/src/components/finance/TransactionTab'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/src/components/ui/Tabs'
import { FinanceTab } from '@/src/declaration/finance'

export default function Page() {
  const tabs = [
    {
      key: 'settings',
      label: 'Thiết lập',
      type: FinanceTab.Settings
    },
    {
      key: 'transactions',
      label: 'Giao dịch',
      type: FinanceTab.Transactions
    },
    {
      key: 'statistic',
      label: 'Thống kê',
      type: FinanceTab.Statistic
    }
  ]

  const [activeTab, setActiveTab] = useState(tabs[0].key)

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
                  case FinanceTab.Settings:
                    return <SettingTab />
                  case FinanceTab.Transactions:
                    return <TransactionTab />
                  // case FinanceTab.Statistic:
                  //   return <StatsTab />
                }
              })()}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
