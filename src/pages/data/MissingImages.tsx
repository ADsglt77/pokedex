import { Button, Stack } from '@camply/ui'
import { ImagePlus } from '@camply/ui/icons'
import { useState } from 'react'
import { useCollectionAction, useNotify } from '@/hooks/useNotify'
import { catalogCard, loadCatalog } from '@/lib/card-catalog'
import { cardImage, findCardImage } from '@/lib/card-images'
import { plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import type { CardImage } from '@/types'

/**
 * Les cartes sans image dont la référence donne un code d'extension et un numéro : chercher leurs
 * images d'un coup chez Pokécardex, sinon celle de TCGplayer que le catalogue relie à la même
 * référence (cartes ajoutées avant ces recherches, ou dont l'image manquait à l'époque).
 */
export function MissingImages() {
  const customCards = useCollectionStore((state) => state.collection.customCards)
  const act = useCollectionAction()
  const notify = useNotify()
  const [searching, setSearching] = useState(false)
  const candidates = Object.values(customCards).filter(
    (card) => !card.image && cardImage(card.reference) !== null,
  )
  if (candidates.length === 0) return null

  const search = async () => {
    setSearching(true)
    // Quatre à la fois : Pokécardex prête ses images, on ne l'inonde pas de requêtes.
    const images: (CardImage | null)[] = []
    for (let start = 0; start < candidates.length; start += 4) {
      const batch = candidates.slice(start, start + 4)
      images.push(
        ...(await Promise.all(batch.map((card) => findCardImage(card.reference, { retry: true })))),
      )
    }
    const catalog = await loadCatalog()
    setSearching(false)
    const found = candidates.flatMap((card, index) => {
      const image = images[index] ?? (catalog && catalogCard(catalog, card.reference)?.image)
      return image ? [{ id: card.id, image }] : []
    })
    const missing = candidates.length - found.length
    const others = missing ? ` ; introuvable pour ${plural(missing, 'autre', 'autres')}` : ''
    if (found.length === 0) {
      notify('Ni Pokécardex ni TCGplayer n’ont l’image de ces cartes.', { tone: 'info' })
      return
    }
    act(
      () => {
        // La carte telle qu'elle est maintenant : une modification faite pendant la recherche
        // reste.
        const { collection, saveCard } = useCollectionStore.getState()
        for (const { id, image } of found) {
          const card = collection.customCards[id]
          if (card && !card.image) saveCard({ ...card, image })
        }
      },
      `${plural(found.length, 'image retrouvée', 'images retrouvées')}${others}.`,
    )
  }

  return (
    <Stack gap={3} align="start">
      <p>
        {plural(candidates.length, 'carte', 'cartes')} sans image :{' '}
        {candidates.length > 1 ? 'leur référence donne' : 'sa référence donne'} un code d’extension
        et un numéro, l’image peut être cherchée chez Pokécardex, sinon chez TCGplayer.
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
