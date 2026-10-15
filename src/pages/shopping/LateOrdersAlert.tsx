import { Alert } from '@camply/ui'

/** Des commandes en cours depuis trop longtemps (`latePendingOrders`) : que faire. */
export function LateOrdersAlert({ title }: { title: string }) {
  return (
    <Alert tone="warn" title={title}>
      Si rien n’est arrivé, contactez le vendeur ; sur Cardmarket, ouvrez un litige depuis la page
      de la commande.
    </Alert>
  )
}
