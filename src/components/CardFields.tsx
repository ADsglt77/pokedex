import { Input, Stack } from '@camply/ui'
import { Suspense, use } from 'react'
import { CardArt } from '@/components/CardArt'
import type { CardDraft } from '@/hooks/useCardDraft'
import { findCardImage } from '@/lib/card-images'
import { formatEuro } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { loadPriceHistory, usePrices } from '@/store/prices'
import styles from './CardFields.module.css'

/**
 * Les champs d'une carte : sa référence (d'où son image est retrouvée), l'adresse de son image
 * (vide : celle retrouvée), son id Cardmarket (vérifié dans les prix), sa page Cardmarket, et
 * l'aperçu de la carte. `speciesId` : pour l'aperçu sans image.
 */
export function CardFields({ draft, speciesId }: { draft: CardDraft; speciesId: number | null }) {
  const { errors } = draft
  return (
    <div className={styles.layout}>
      <Stack gap={4}>
        <Input
          label="Référence"
          hint="Le nom, puis le code de l’extension et le numéro, comme chez Cardmarket : « Bulbizarre (sv2a 166) ». Il sert à trouver l’image. Vide : le nom de la carte chez Cardmarket."
          value={draft.reference}
          onChange={(event) => draft.setReference(event.target.value)}
          onBlur={draft.searchImage}
        />
        <Input
          label="Adresse de l’image"
          hint="Facultatif : vide, l’image est cherchée chez Pokécardex d’après la référence. Sinon, clic droit sur une image en ligne › « Copier l’adresse de l’image » (pas sur Cardmarket : ses images ne s’affichent que chez lui)."
          placeholder="https://…"
          inputMode="url"
          value={draft.image}
          onChange={(event) => draft.setImage(event.target.value)}
          error={errors.image}
        />
        {draft.lookup !== null && (
          <Suspense fallback={<p className="muted">Recherche de l’image…</p>}>
            <FoundImage reference={draft.lookup} />
          </Suspense>
        )}
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
          label="Page Cardmarket"
          hint="Facultatif : l’adresse de sa page, pour y retourner l’acheter."
          placeholder="https://www.cardmarket.com/…"
          inputMode="url"
          value={draft.page}
          onChange={(event) => draft.setPage(event.target.value)}
          error={errors.page}
        />
      </Stack>
      {speciesId !== null && (
        <Suspense fallback={<Preview draft={draft} speciesId={speciesId} searching />}>
          <Preview draft={draft} speciesId={speciesId} />
        </Suspense>
      )}
    </div>
  )
}

/**
 * L'aperçu : l'adresse collée, sinon l'image retrouvée ; sans image, ou si l'adresse ne mène pas à
 * une image, la carte de substitution. `searching` : pendant la recherche.
 */
function Preview({
  draft,
  speciesId,
  searching,
}: {
  draft: CardDraft
  speciesId: number
  searching?: boolean
}) {
  const found = searching || draft.lookup === null ? null : use(findCardImage(draft.lookup))
  return (
    <CardArt
      card={{ image: draft.pasted ?? found, reference: draft.reference }}
      speciesId={speciesId}
      alt="Aperçu de la carte"
      className={styles.preview}
    />
  )
}

/** Ce que Pokécardex a pour la référence : l'image, ou rien. */
function FoundImage({ reference }: { reference: string }) {
  const image = use(findCardImage(reference))
  return image ? (
    <p className={styles.check}>
      Image trouvée chez Pokécardex d’après la référence : vérifiez l’aperçu.
    </p>
  ) : (
    <p className={styles.warn}>
      Pokécardex n’a pas l’image de cette carte, ou ne répond pas (elle sera cherchée de nouveau à
      l’enregistrement) : vérifiez la référence, ou collez une adresse si vous voulez.
    </p>
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
