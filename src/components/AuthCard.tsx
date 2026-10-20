import { Alert, Button, Card, CardDescription, CardHeader, CardTitle, Stack } from '@camply/ui'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { SiteDisclaimer } from '@/components/SiteDisclaimer'
import { pageTitle } from '@/lib/format'
import styles from './AuthCard.module.css'

/**
 * Une page du compte (connexion, inscription), hors de la coquille : son `<main>`, la marque
 * (logo et nom) au-dessus d'une carte seule, centrée, son titre (le `h1` de la page) et son
 * chapeau, puis son formulaire (`children`, ses champs) et son bouton (`submit`), et le lien
 * vers l'autre page (`other`) ; dessous, le pied de page (les mentions légales). `onSubmit` envoie
 * le formulaire et rend ce qui l'a refusé, montré au-dessus des champs, ou `null` ; le bouton est en
 * chargement jusque-là.
 */
export function AuthCard({
  title,
  description,
  submit,
  onSubmit,
  other,
  children,
}: {
  title: string
  description: ReactNode
  submit: { label: string; icon: ReactNode }
  onSubmit: () => Promise<string | null>
  other: { to: string; label: string }
  children: ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const problem = await onSubmit()
    setBusy(false)
    setError(problem)
  }

  return (
    <main className={styles.page}>
      <title>{pageTitle(title)}</title>
      <Logo>Mon Pokédex</Logo>
      <Card padding="lg" className={styles.card}>
        <CardHeader>
          <CardTitle headingLevel={1} className={styles.title}>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <form onSubmit={send} className={styles.form}>
          <Stack gap={4}>
            {error && <Alert tone="danger" title={error} />}
            {children}
            <Button type="submit" fullWidth loading={busy} leftIcon={submit.icon}>
              {submit.label}
            </Button>
          </Stack>
        </form>
        <Link to={other.to} className={styles.other}>
          {other.label}
        </Link>
      </Card>
      <footer className={styles.footer}>
        <SiteDisclaimer />
      </footer>
    </main>
  )
}
