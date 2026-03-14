'use client'

import { Mail, MapPin } from 'lucide-react'
import { Button } from '@/src/components/ui/Button'
import { useTranslations } from 'next-intl'
import { Welcome } from './Welcome'

export function PersonalInfo() {
  const t = useTranslations('Home')

  function openMail() {
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        'pna7702@gmail.com'
      )}`,
      '_blank'
    )
  }

  return (
    <section className="relative">
      <div className="space-y-6">
        <Welcome />
        <div className="flex items-center space-x-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{t('location')}</span>
        </div>
        <div className="flex space-x-4 items-center">
          <Button variant="default" size="lg" onClick={openMail}>
            <Mail className="h-4 w-4 mr-2" />
            {t('contact')}
          </Button>
        </div>
      </div>
    </section>
  )
}
