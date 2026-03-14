import { useTranslations } from 'next-intl'

export const Welcome = () => {
  const t = useTranslations('Home')
  return (
    <div className="space-y-4">
      <h1 className="text-5xl font-bold">
        {t('welcome')}
        <br />
      </h1>
      <h1 className="mt-2 font-bold">
        <span className="text-6xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Utopiosphere
        </span>
        <br />
        <span className="text-6xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mt-2 block">
          ユートピオスフィア
        </span>
      </h1>
      <p className="text-xl text-muted-foreground">Tiếng Việt & English</p>
      <p className="text-muted-foreground leading-relaxed">
        {t('description').split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </p>
    </div>
  )
}
