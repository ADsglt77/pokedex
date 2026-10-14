import { Alert } from '@camply/ui'
import type { ReactNode } from 'react'

/**
 * Des commandes en cours depuis trop longtemps (`latePendingOrders`) : que faire. `children` : ce
 * qui suit le conseil (un lien vers les commandes…).
 */
export function LateOrdersAlert({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children?: ReactNode
}) {
  return (
    <Alert tone="warn" title={title} className={className}>
      Si rien n’est arrivé, contactez le vendeur ; sur Cardmarket, ouvrez un litige depuis la page
      de la commande.{children && <> {children}</>}
    </Alert>
  )
}
