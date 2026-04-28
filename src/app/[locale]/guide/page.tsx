import { useTranslations } from 'next-intl'
import {
  Bird,
  Sun,
  Languages,
  Search,
  FolderKanban,
  Music,
  BarChart3,
  BookOpen
} from 'lucide-react'

const sectionIcons: Record<string, React.ReactNode> = {
  navigation: <Bird className="h-5 w-5" />,
  theme: <Sun className="h-5 w-5" />,
  language: <Languages className="h-5 w-5" />,
  search: <Search className="h-5 w-5" />,
  projects: <FolderKanban className="h-5 w-5" />,
  music: <Music className="h-5 w-5" />,
  discipline: <BarChart3 className="h-5 w-5" />,
  chinese: <BookOpen className="h-5 w-5" />
}

export default function GuidePage() {
  const t = useTranslations('Guide')

  const basicSections = ['navigation', 'theme', 'language', 'search', 'projects', 'music']
  const advancedSections = ['discipline', 'chinese']

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t('title')}
        </h1>
        <p className="text-xl text-muted-foreground">{t('description')}</p>
      </div>

      {/* Basic features */}
      <div className="grid gap-4 sm:grid-cols-2">
        {basicSections.map((key) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-card p-5 space-y-2"
          >
            <div className="flex items-center gap-2 text-primary font-semibold">
              {sectionIcons[key]}
              <span>{t(`sections.${key}.title` as any)}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`sections.${key}.description` as any)}
            </p>
          </div>
        ))}
      </div>

      {/* Advanced features */}
      <div className="space-y-6">
        {advancedSections.map((key) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-card p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-primary font-semibold text-lg">
              {sectionIcons[key]}
              <span>{t(`sections.${key}.title` as any)}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`sections.${key}.description` as any)}
            </p>

            {key === 'discipline' && (
              <div className="grid gap-3 sm:grid-cols-3">
                {(['settings', 'transactions', 'statistics'] as const).map((tab) => (
                  <div key={tab} className="rounded-md bg-muted/50 p-4 space-y-1">
                    <p className="font-medium text-sm text-foreground">
                      {t(`sections.discipline.tabs.${tab}.name` as any)}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(`sections.discipline.tabs.${tab}.description` as any)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {key === 'chinese' && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['all', 'byRadical'] as const).map((mode) => (
                    <div key={mode} className="rounded-md bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t(`sections.chinese.modes.${mode}` as any)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {(['hide', 'knownFilter', 'edit'] as const).map((feat) => (
                    <div key={feat} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {t(`sections.chinese.features.${feat}` as any)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
