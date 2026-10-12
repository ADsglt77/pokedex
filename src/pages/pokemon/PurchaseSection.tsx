import { Button, SegmentedControl, Stack } from '@camply/ui'
import { Link } from 'react-router'
import { PreferenceFields } from '@/components/PreferenceFields'
import { useCollectionAction } from '@/hooks/useNotify'
import type { CardView } from '@/lib/candidates'
import { formatEuro } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { type Decision, priceVerdict } from '@/lib/wishlist'
import { usePrices } from '@/store/prices'
import { useShoppingStore } from '@/store/shopping'
import type { PurchasePreference } from '@/types'
import styles from './CardActions.module.css'

type Choice = Decision | 'none'

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'none', label: 'Non décidée' },
  { value: 'accepted', label: 'À acheter' },
  { value: 'excluded', label: 'Exclue' },
]

const MESSAGES: Record<Choice, string> = {
  none: 'retirée de vos préférences d’achat',
  accepted: 'ajoutée à la liste d’achats',
  excluded: 'exclue des achats',
}

/**
 * Accepter une carte à l'achat (dans la liste d'achats), ou l'exclure. Indépendant du statut :
 * on peut accepter plusieurs illustrations d'un Pokémon, et n'en acheter qu'une.
 */
export function PurchaseSection({ candidate }: { candidate: CardView }) {
  const act = useCollectionAction()
  const { card, status } = candidate
  const preference = useShoppingStore((state) => state.shopping.preferences[card.id])
  const price = priceOf(usePrices(), card)?.price ?? null
  const choice = preference?.decision ?? 'none'

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
    return 'À acheter : la carte entre dans votre liste d’achats. Vous pouvez en accepter plusieurs pour un même Pokémon.'
  }
  if (choice === 'excluded') return 'Cette carte ne vous sera jamais proposée à l’achat.'
  if (status === 'owned') return 'Dans votre liste d’achats. Possédée : elle n’est plus proposée.'
  if (status === 'ordered')
    return 'Dans votre liste d’achats. Commandée : elle n’est plus proposée.'
  const verdict = priceVerdict(price, preference?.maxPrice)
  if (!verdict) return 'Dans votre liste d’achats.'
  return `Prix du marché ${formatEuro(price!)} : ${verdict === 'under' ? 'sous' : 'au-dessus de'} votre prix maximum.`
}
