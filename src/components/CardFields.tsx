import { Input, Stack } from '@camply/ui'
import { Suspense, use } from 'react'
import { CardArt } from '@/components/CardArt'
import type { CardDraft } from '@/hooks/useCardDraft'
import { formatEuro } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { loadPriceHistory, usePrices } from '@/store/prices'
import styles from './CardFields.module.css'

/**
 * Les champs d'une carte : l'adresse de son image (avec son aperçu), son id Cardmarket (vérifié
 * chez Cardmarket), sa référence, sa page Cardmarket. `speciesId` : pour l'aperçu sans image.
 */
export function CardFields({ draft, speciesId }: { draft: CardDraft; speciesId: number | null }) {
  const { imageUrl, errors } = draft
  return (
    <div className={styles.layout}>
      <Stack gap={4}>
        <Input
          label="Adresse de l’image"
          hint="Facultatif. Clic droit sur l’image d’une carte, en ligne › « Copier l’adresse de l’image » (pas sur Cardmarket : ses images ne s’affichent que chez lui)."
          placeholder="https://…"
          inputMode="url"
          value={draft.image}
          onChange={(event) => draft.setImage(event.target.value)}
          error={errors.image}
        />
        <Input
          label="Id Cardmarket"
          hint="Le numéro du produit chez Cardmarket (idProduct), pour son prix. Le favori le remplit."
          inputMode="numeric"
          value={draft.cardmarketText}
          onChange={(event) => draft.setCardmarketText(event.target.value)}
          onBlur={draft.check}
          error={errors.cardmarket}
        />
        {draft.checkedId !== null && (
          <Suspense fallback={<p className="muted">Recherche de la carte chez Cardmarket…</p>}>
            <CardmarketCheck cardmarket={draft.checkedId} />
          </Suspense>
        )}
        <Input
          label="Référence"
          hint="Pour vous y retrouver : « SV4a 349 »… Vide, le nom de la carte chez Cardmarket."
          value={draft.reference}
          onChange={(event) => draft.setReference(event.target.value)}
        />
        <Input
          label="Page Cardmarket"
          hint="Facultatif : l’adresse de sa page, pour y retourner l’acheter."
          placeholder="https://www.cardmarket.com/…"
          inputMode="url"
          value={draft.page}
          onChange={(event) => draft.setPage(event.target.value)}
          error={errors.page}
        />
      </Stack>
      {/* L'aperçu : sans image, ou si l'adresse ne mène pas à une image, la carte de substitution. */}
      {speciesId !== null && (
        <CardArt
          card={{
            image: imageUrl && { small: imageUrl.href, large: imageUrl.href },
            reference: draft.reference,
          }}
          speciesId={speciesId}
          alt="Aperçu de la carte"
          className={styles.preview}
        />
      )}
    </div>
  )
}

/** Ce que Cardmarket dit de l'id saisi : le nom de la carte et son prix, pour s'assurer du bon. */
function CardmarketCheck({ cardmarket }: { cardmarket: number }) {
  const history = use(loadPriceHistory(cardmarket))
  const price = priceOf(usePrices(), { cardmarket })
  if (!history) {
    return (
      <p className={styles.warn}>
        Cet id est inconnu des prix Cardmarket : vérifiez-le (la carte n’aura pas de prix).
      </p>
    )
  }
  return (
    <p className={styles.check}>
      Chez Cardmarket : <strong>{history.name ?? 'carte sans nom'}</strong>
      {price && ` · ${formatEuro(price.price)}`}
    </p>
  )
}
