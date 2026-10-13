import { Button, Stack } from '@camply/ui'
import { ImagePlus } from '@camply/ui/icons'
import { useState } from 'react'
import { useCollectionAction, useNotify } from '@/hooks/useNotify'
import { findCardImage, imageLoads } from '@/lib/card-images'
import { plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'

/**
 * Les cartes sans image dont la référence donne une extension connue de TCGdex : chercher leurs
 * images d'un coup (celles ajoutées avant cette recherche, ou sans image chez TCGdex à l'époque).
 */
export function MissingImages() {
  const customCards = useCollectionStore((state) => state.collection.customCards)
  const act = useCollectionAction()
  const notify = useNotify()
  const [searching, setSearching] = useState(false)
  const candidates = Object.values(customCards).flatMap((card) => {
    const image = card.image ? null : findCardImage(card.reference)
    return image ? [{ id: card.id, image }] : []
  })
  if (candidates.length === 0) return null

  const search = async () => {
    setSearching(true)
    const loaded = await Promise.all(
      candidates.map(({ image }) => imageLoads(image.small, { retry: true })),
    )
    setSearching(false)
    const found = candidates.filter((_, index) => loaded[index])
    const missing = candidates.length - found.length
    const others = missing
      ? ` ; TCGdex n’a pas celle des ${plural(missing, 'autre', 'autres')}`
      : ''
    if (found.length === 0) {
      notify('TCGdex n’a l’image d’aucune de ces cartes.', { tone: 'info' })
      return
    }
    act(
      () => {
        // La carte telle qu'elle est maintenant : une modification faite pendant la recherche reste.
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
        {candidates.length > 1 ? 'leur référence donne' : 'sa référence donne'} une extension que
        TCGdex connaît.
      </p>
      <Button
        variant="soft"
        leftIcon={<ImagePlus size={16} />}
        loading={searching}
        onClick={search}
      >
        Chercher les images chez TCGdex
      </Button>
    </Stack>
  )
}
