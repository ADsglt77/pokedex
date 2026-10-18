import { Card, CardDescription, CardHeader } from '@camply/ui'
import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import styles from './AuthCard.module.css'

/**
 * Une page du compte (connexion, première visite), hors de la coquille : son `<main>`, la marque
 * (logo et nom) au-dessus d'une carte seule, centrée, son titre (`h1` : camply n'a pas de
 * `CardTitle` de niveau 1) et son chapeau, puis son contenu.
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
          <h1 className={styles.title}>{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children}
      </Card>
    </main>
  )
}
