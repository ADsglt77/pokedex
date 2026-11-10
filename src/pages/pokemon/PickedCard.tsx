import { Skeleton } from '@camply/ui'
import { useMemo } from 'react'
import { CardReference } from '@/components/LanguageSwitch'
import type { CardDraft } from '@/hooks/useCardDraft'
import { languageField } from '@/lib/collection'
import { priceText } from '@/lib/prices'
import { usePrices, usePricesMissing } from '@/store/prices'
import { CardPreview } from './CardFields'
import styles from './CardFields.module.css'

/**
 * La carte choisie au catalogue, en résumé, au-dessus de « Ajouter comme » : son aperçu, sa
 * référence et le drapeau de sa langue, son prix du jour. C'est ce que la saisie enregistrera : un
 * détail corrigé sous « Modifier les détails » s'y montre, la référence aussitôt, l'aperçu en
 * quittant la référence, et le prix en quittant l'id (`cardmarket` : l'id vérifié, `checkedId`,
 * celui du catalogue au choix ; vidé, la carte n'a pas de prix).
 */
export function PickedCard({
  draft,
  speciesId,
  cardmarket,
}: {
  draft: CardDraft
  speciesId: number
  cardmarket: number | undefined
}) {
  const ids = useMemo(() => (cardmarket === undefined ? [] : [cardmarket]), [cardmarket])
  const prices = usePrices(ids)
  const missing = usePricesMissing(ids)
  const price = priceText(prices, missing, { cardmarket })
  return (
    <div className={styles.picked}>
      <CardPreview draft={draft} speciesId={speciesId} />
      <div>
        <p className={styles.pickedReference}>
          <CardReference card={{ reference: draft.reference, ...languageField(draft.language) }} />
        </p>
        <p className="muted">
          Prix du jour&nbsp;: {price ?? <Skeleton variant="text" width="3rem" />}
        </p>
      </div>
    </div>
  )
}
