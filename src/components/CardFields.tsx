import { Input, Stack } from '@camply/ui'
import { Suspense, use } from 'react'
import { CardArt } from '@/components/CardArt'
import { ImageCredit } from '@/components/ImageCredit'
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
            <FoundImage reference={draft.lookup} replaced={draft.fallback !== null} />
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
            <CardmarketCheck cardmarket={draft.checkedId} reference={draft.reference} />
          </Suspense>
        )}
        <Input
          label="Page Cardmarket"
          hint="Facultatif : vide, le lien se fait par l’id Cardmarket. Le favori y met la page exacte."
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
 * L'aperçu : l'adresse collée, sinon l'image retrouvée chez Pokécardex, sinon celle de TCGplayer
 * (chacune citée) ; sans image, ou si l'adresse ne mène pas à une image, la carte de substitution.
 * `searching` : pendant la recherche.
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
  const image = draft.pasted ?? found ?? (searching ? null : draft.fallback)
  return (
    <figure className={styles.preview}>
      <CardArt
        card={{ image, reference: draft.reference }}
        speciesId={speciesId}
        alt="Aperçu de la carte"
      />
      <ImageCredit image={image} className={styles.credit} />
    </figure>
  )
}

/**
 * Ce que Pokécardex a pour la référence : l'image, ou rien (`replaced` : l'image de TCGplayer la
 * remplace alors).
 */
function FoundImage({ reference, replaced }: { reference: string; replaced: boolean }) {
  const image = use(findCardImage(reference))
  if (image) {
    return (
      <p className={styles.check}>
        Image trouvée chez Pokécardex d’après la référence : vérifiez l’aperçu.
      </p>
    )
  }
  return replaced ? (
    <p className={styles.check}>
      Pokécardex n’a pas l’image de cette carte : celle de TCGplayer la remplace. Vérifiez l’aperçu.
    </p>
  ) : (
    <p className={styles.warn}>
      Pokécardex n’a pas l’image de cette carte, ou ne répond pas (elle sera cherchée de nouveau à
      l’enregistrement) : vérifiez la référence, ou collez une adresse si vous voulez.
    </p>
  )
}

/**
 * Ce que Cardmarket dit de l'id saisi : le nom de la carte et son prix, pour s'assurer du bon. Sans
 * prix Cardmarket ce jour, celui de TCGplayer que la carte prendra d'après le code de sa référence,
 * s'il y en a un.
 */
function CardmarketCheck({ cardmarket, reference }: { cardmarket: number; reference: string }) {
  const prices = usePrices()
  const history = use(loadPriceHistory(cardmarket))
  const price = priceOf(prices, { cardmarket, reference })
  // Sans historique, l'id n'a jamais eu de prix depuis le premier relevé ; s'il en a un ce jour,
  // c'est que l'historique n'a pas répondu (il sera redemandé).
  if (!history && price?.source !== 'cardmarket') {
    return (
      <p className={styles.warn}>
        Pas de prix Cardmarket connu pour cet id : vérifiez-le (un id juste peut aussi n’avoir
        jamais eu de prix).
        {price
          ? ` La carte prendra celui de TCGplayer (${formatEuro(price.price)}), d’après le code de sa référence.`
          : prices && ' La carte n’aura pas de prix.'}
      </p>
    )
  }
  return (
    <p className={styles.check}>
      Chez Cardmarket : <strong>{history?.name ?? 'carte sans nom'}</strong>
      {price?.source === 'cardmarket' && ` · ${formatEuro(price.price)}`}
      {price?.source === 'tcgplayer' &&
        ` · pas de prix ce jour, ${formatEuro(price.price)} chez TCGplayer`}
    </p>
  )
}
