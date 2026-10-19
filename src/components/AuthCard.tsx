import { Card, CardDescription, CardHeader, CardTitle } from '@camply/ui'
import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import { SiteDisclaimer } from '@/components/SiteDisclaimer'
import styles from './AuthCard.module.css'

/**
 * Une page du compte (connexion, inscription), hors de la coquille : son `<main>`, la marque
 * (logo et nom) au-dessus d'une carte seule, centrée, son titre (le `h1` de la page) et son
 * chapeau, puis son contenu ; dessous, le pied de page (les mentions légales).
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children: ReactNode
}) {
  return (
    <main className={styles.page}>
      <Logo>Mon Pokédex</Logo>
      <Card padding="lg" className={styles.card}>
        <CardHeader>
          <CardTitle headingLevel={1} className={styles.title}>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children}
      </Card>
      <footer className={styles.footer}>
        <SiteDisclaimer />
      </footer>
    </main>
  )
}
