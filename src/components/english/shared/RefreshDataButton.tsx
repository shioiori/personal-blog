'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/src/components/ui/Button'
import { useEnglishStudy } from '@/src/context/english'
import { useTranslations } from 'next-intl'

export function RefreshDataButton() {
  const t = useTranslations('English.Tabs')
  const { refetchAll } = useEnglishStudy()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refetchAll()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={refreshing}
      className="shrink-0"
    >
      <RefreshCw className={refreshing ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{t('refresh')}</span>
    </Button>
  )
}
