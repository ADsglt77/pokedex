import { Stack } from '@camply/ui'
import { CommitInput, EuroInput } from '@/components/CommitInput'
import { SegmentedField } from '@/components/SegmentedField'
import { PRIORITY_LABELS } from '@/config/shopping'
import { useCollectionAction } from '@/hooks/useNotify'
import { formatEuro, toOptions } from '@/lib/format'
import { parseCardmarketLink, type PreferenceChange } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import type { PokemonCard, PurchasePreference } from '@/types'

const PRIORITY_OPTIONS = toOptions(PRIORITY_LABELS)
const asText = (text: string) => text

/**
 * Ce qu'on règle sur une carte de la liste d'achats : priorité, prix maximum, lien Cardmarket et
 * note. Chaque changement est enregistré aussitôt, avec « Annuler ».
 */
export function PreferenceFields({
  card,
  preference,
}: {
  card: PokemonCard
  preference: PurchasePreference
}) {
  const act = useCollectionAction()
  const change = (patch: PreferenceChange, message: string) =>
    act(() => useShoppingStore.getState().updatePreference(card.id, patch), message)

  return (
    <Stack gap={4}>
      <SegmentedField
        label="Priorité"
        fullWidth
        options={PRIORITY_OPTIONS}
        value={preference.priority}
        onChange={(priority) =>
          change(
            { priority },
            `Priorité ${PRIORITY_LABELS[priority].toLowerCase()} pour la carte ${card.reference}.`,
          )
        }
      />
      <EuroInput
        label="Prix maximum"
        hint="Au-delà, la carte n’est pas proposée pour la prochaine commande."
        value={preference.maxPrice}
        onCommit={(maxPrice) =>
          change(
            { maxPrice },
            maxPrice === undefined
              ? `Prix maximum retiré de la carte ${card.reference}.`
              : `Prix maximum de ${formatEuro(maxPrice)} pour la carte ${card.reference}.`,
          )
        }
      />
      <CommitInput
        label="Page Cardmarket"
        hint="Facultatif : l’adresse de la page du produit, copiée depuis Cardmarket."
        placeholder="https://www.cardmarket.com/…"
        inputMode="url"
        value={preference.link}
        parse={parseCardmarketLink}
        format={asText}
        invalid="Collez une adresse de www.cardmarket.com."
        onCommit={(link) =>
          change(
            { link },
            link
              ? `Page Cardmarket enregistrée pour la carte ${card.reference}.`
              : `Page Cardmarket retirée de la carte ${card.reference}.`,
          )
        }
      />
      <CommitInput
        label="Note"
        placeholder="État souhaité, vendeur…"
        value={preference.note}
        parse={asText}
        format={asText}
        onCommit={(note) =>
          change(
            { note },
            note
              ? `Note enregistrée pour la carte ${card.reference}.`
              : `Note retirée de la carte ${card.reference}.`,
          )
        }
      />
    </Stack>
  )
}
