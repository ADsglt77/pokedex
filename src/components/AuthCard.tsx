import { Card, CardDescription, CardHeader } from '@camply/ui'
import type { ReactNode } from 'react'
import styles from './AuthCard.module.css'

/** Trop de tentatives (5 par minute, `server/auth.ts`) : la réponse 429 du serveur. */
export const TOO_MANY_ATTEMPTS = 'Trop de tentatives : réessayez dans une minute.'

/**
 * Une page du compte (connexion, première visite) : une carte seule, centrée, son titre (`h1` :
 * camply n'a pas de `CardTitle` de niveau 1) et son chapeau, puis son contenu.
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
    <div className={styles.page}>
      <Card padding="lg" className={styles.card}>
        <CardHeader>
          <h1 className={styles.title}>{title}</h1>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children}
      </Card>
    </div>
  )
}
