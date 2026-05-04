'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Sun, Moon, Bird, Menu, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/src/components/ui/Button'
import { SearchDialog } from '@/src/components/SearchDialog'
import { useContext, useEffect, useState } from 'react'
import { Language, LanguagesLabel, Theme } from './enums'

import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/src/components/ui/DropdownMenu'
import { useTranslations } from 'next-intl'
import { LanguageContext } from '../context/language'

export function Header() {
  const t = useTranslations('Header')
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [language, setLanguage] = useState<Language>()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const languageContext = useContext(LanguageContext)

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    languageContext?.setLocale && languageContext.setLocale(lang)
  }

  const toggleTheme = () => {
    setTheme(theme == Theme.Light ? Theme.Dark : Theme.Light)
  }

  const navigation = [
    { name: t('home'), href: '/' },
    { name: t('guide'), href: '/guide' },
    // { name: t('aboutme'), href: '/about' },
    // { name: t('blog'), href: '/blog' },
    { name: t('project'), href: '/projects' },
    { name: t('music'), href: '/music' },
    { name: t('discipline'), href: '/discipline' },
    { name: t('hantu'), href: '/chinese' }
  ]

  useEffect(() => {
    setLanguage(languageContext?.locale)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Bird className="h-8 w-8" />
            <span className="hidden md:inline text-xl font-bold">ユートピオスフィア</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === item.href
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center px-3 h-9">
                  <span className="mr-2">
                    {language && LanguagesLabel.get(language)}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[Language.VI, Language.EN].map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                  >
                    {LanguagesLabel.get(lang)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              className="h-9 w-9"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">{t('search')}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 transition-all duration-200 hover:scale-110 hover:bg-accent/50"
            >
              <div className="relative z-10">
                {theme == Theme.Light ? (
                  <Sun className="h-4 w-4 transition-all duration-300 rotate-0 scale-100" />
                ) : (
                  <Moon className="h-4 w-4 transition-all duration-300 rotate-0 scale-100" />
                )}
              </div>
              <span className="sr-only">{t('toggleTheme')}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden h-9 w-9"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </div>
        </div>

        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      </header>

      {mobileMenuOpen && (
        <>
          {/* overlay */}
          <div
            className="fixed inset-0 z-[90] bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* sidebar */}
          <div className="fixed top-0 right-0 z-[100] h-full w-64 bg-background border-l border-border shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Bird className="h-6 w-6" />
                <span className="text-sm font-bold">ユートピオスフィア</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col p-4 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-primary hover:bg-accent ${
                    pathname === item.href
                      ? 'text-primary bg-accent'
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  )
}
