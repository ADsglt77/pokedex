import { Button, SegmentedControl, Stack } from '@camply/ui'
import { Link } from 'react-router'
import { PreferenceFields } from '@/components/PreferenceFields'
import { useCollectionAction } from '@/hooks/useNotify'
import type { CardView } from '@/lib/pokedex'
import { formatEuro } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { priceVerdict } from '@/lib/purchase-planner'
import { usePrices } from '@/store/prices'
import { useShoppingStore } from '@/store/shopping'
import type { PurchasePreference } from '@/types'
import styles from './CardActions.module.css'

type Choice = 'accepted' | 'none'

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'none', label: 'Non décidée' },
  { value: 'accepted', label: 'À acheter' },
]

const MESSAGES: Record<Choice, string> = {
  none: 'retirée de la liste d’achats',
  accepted: 'ajoutée à la liste d’achats',
}

/**
 * Mettre une carte dans la liste d'achats, ou l'en retirer. Indépendant de son statut. Une
 * préférence `excluded` d'une ancienne version compte comme non décidée.
 */
export function PurchaseSection({ view }: { view: CardView }) {
  const act = useCollectionAction()
  const { card, status } = view
  const preference = useShoppingStore((state) => state.shopping.preferences[card.id])
  const price = priceOf(usePrices(), card)?.price ?? null
  const choice: Choice = preference?.decision === 'accepted' ? 'accepted' : 'none'

  const decide = (next: Choice) =>
    act(
      () => useShoppingStore.getState().setDecision(card.id, next === 'none' ? null : next),
      `Carte ${card.reference} ${MESSAGES[next]}.`,
      next === 'accepted' ? 'success' : 'info',
    )

  return (
    <Stack as="section" gap={3} className={styles.group} aria-labelledby="purchase-title">
      <h3 id="purchase-title" className={styles.groupTitle}>
        Achat
      </h3>
      <SegmentedControl
        aria-labelledby="purchase-title"
        size="sm"
        fullWidth
        options={CHOICES}
        value={choice}
        onChange={decide}
      />
      <p className={styles.hint}>{purchaseHint(choice, status, preference, price)}</p>
      {preference?.decision === 'accepted' && (
        <>
          <PreferenceFields card={card} preference={preference} />
          <div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/achats">Voir la liste d’achats</Link>
            </Button>
          </div>
        </>
      )}
    </Stack>
  )
}

function purchaseHint(
  choice: Choice,
  status: CardView['status'],
  preference: PurchasePreference | undefined,
  price: number | null,
): string {
  if (choice === 'none') {
    return 'À acheter : la carte entre dans votre liste d’achats.'
  }
  if (status === 'owned') return 'Dans votre liste d’achats. Possédée : elle n’est plus proposée.'
  if (status === 'ordered')
    return 'Dans votre liste d’achats. Commandée : elle n’est plus proposée.'
  const verdict = priceVerdict(price, preference?.maxPrice)
  if (!verdict) return 'Dans votre liste d’achats.'
  return `Prix du marché ${formatEuro(price!)} : ${verdict === 'under' ? 'sous' : 'au-dessus de'} votre prix maximum.`
}
