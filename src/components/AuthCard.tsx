import { Alert, Card, CardDescription, CardHeader, CardTitle, Stack } from '@camply/ui'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { SiteDisclaimer } from '@/components/SiteDisclaimer'
import { pageTitle } from '@/lib/format'
import styles from './AuthCard.module.css'

/**
 * Une page du compte (connexion, inscription), hors de la coquille : son `<main>`, la marque
 * (logo et nom) au-dessus d'une carte seule, centrée, son titre (le `h1` de la page) et son
 * chapeau, puis son formulaire (`children`, ses champs et son bouton ; `error` au-dessus) et le
 * lien vers l'autre page (`other`) ; dessous, le pied de page (les mentions légales).
 */
export function AuthCard({
  title,
  description,
  error,
  onSubmit,
  other,
  children,
}: {
  title: string
  description: ReactNode
  error: string | null
  onSubmit: (event: FormEvent) => void
  other: { to: string; label: string }
  children: ReactNode
}) {
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
        <form onSubmit={onSubmit} className={styles.form}>
          <Stack gap={4}>
            {error && <Alert tone="danger" title={error} />}
            {children}
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
