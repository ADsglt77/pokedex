import { Button, Stack } from '@camply/ui'
import { ImagePlus } from '@camply/ui/icons'
import { useState } from 'react'
import { useCollectionAction, useNotify } from '@/hooks/useNotify'
import { findCardImage } from '@/lib/card-catalog'
import { isTcgplayerImage } from '@/lib/card-images'
import { referenceCode } from '@/lib/card-code'
import { plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import type { CardImage, PokemonCard } from '@/types'

/** Une carte à qui chercher une image : sans image, ou avec celle de TCGplayer (retiré). */
const lacksImage = (card: PokemonCard) => !card.image || isTcgplayerImage(card.image)

/**
 * Les cartes sans image, ou avec une image de TCGplayer (d'une ancienne version), dont la
 * référence donne un code de série et un numéro : chercher leurs images d'un coup chez Pokécardex
 * (cartes ajoutées avant ces recherches, ou dont l'image manquait à l'époque).
 */
export function MissingImages() {
  const customCards = useCollectionStore((state) => state.collection.customCards)
  const act = useCollectionAction()
  const notify = useNotify()
  const [searching, setSearching] = useState(false)
  const candidates = Object.values(customCards).filter(
    (card) => lacksImage(card) && referenceCode(card.reference) !== null,
  )
  if (candidates.length === 0) return null

  const search = async () => {
    setSearching(true)
    // Quatre à la fois : le serveur copie chaque image de Pokécardex à sa première demande.
    const images: (CardImage | null)[] = []
    for (let start = 0; start < candidates.length; start += 4) {
      const batch = candidates.slice(start, start + 4)
      images.push(
        ...(await Promise.all(batch.map((card) => findCardImage(card.reference, { retry: true })))),
      )
    }
    setSearching(false)
    const found = candidates.flatMap((card, index) => {
      const image = images[index]
      return image ? [{ id: card.id, image }] : []
    })
    const missing = candidates.length - found.length
    const others = missing ? ` ; introuvable pour ${plural(missing, 'autre', 'autres')}` : ''
    if (found.length === 0) {
      notify('Pokécardex n’a pas l’image de ces cartes.', { tone: 'info' })
      return
    }
    act(
      () => {
        // La carte telle qu'elle est maintenant : une modification faite pendant la recherche
        // reste.
        const { collection, saveCard } = useCollectionStore.getState()
        for (const { id, image } of found) {
          const card = collection.customCards[id]
          if (card && lacksImage(card)) saveCard({ ...card, image })
        }
      },
      `${plural(found.length, 'image retrouvée', 'images retrouvées')}${others}.`,
    )
  }

  return (
    <Stack gap={3} align="start">
      <p>
        {plural(candidates.length, 'carte', 'cartes')} sans image de Pokécardex :{' '}
        {candidates.length > 1 ? 'leur référence donne' : 'sa référence donne'} un code de série et
        un numéro, l’image peut y être cherchée.
      </p>
      <Button
        variant="soft"
        leftIcon={<ImagePlus size={16} />}
        loading={searching}
        onClick={search}
      >
        Chercher les images
      </Button>
    </Stack>
  )
}
