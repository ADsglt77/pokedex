import { Button, Stack } from '@camply/ui'
import { ImagePlus } from '@camply/ui/icons'
import { useState } from 'react'
import { useCollectionAction, useNotify } from '@/hooks/useNotify'
import { cardImage, findCardImage } from '@/lib/card-images'
import { plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'

/**
 * Les cartes sans image dont la référence donne un code d'extension et un numéro : chercher leurs
 * images d'un coup chez Pokécardex (celles ajoutées avant cette recherche, ou dont l'image manquait
 * à l'époque).
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
    const images = await Promise.all(
      candidates.map((card) => findCardImage(card.reference, { retry: true })),
    )
    setSearching(false)
    const found = candidates.flatMap((card, index) => {
      const image = images[index]
      return image ? [{ id: card.id, image }] : []
    })
    const missing = candidates.length - found.length
    const others = missing ? ` ; introuvable pour ${plural(missing, 'autre', 'autres')}` : ''
    if (found.length === 0) {
      notify('Pokécardex n’a l’image d’aucune de ces cartes.', {
        tone: 'info',
      })
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
        et un numéro, l’image peut être cherchée chez Pokécardex.
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
