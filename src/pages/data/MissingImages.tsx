import { Button, Stack } from '@camply/ui'
import { ImagePlus } from '@camply/ui/icons'
import { useState, type RefObject } from 'react'
import { useCollectionAction, useNotify } from '@/hooks/useNotify'
import { findCardImage } from '@/lib/card-catalog'
import { referenceCode } from '@/lib/card-code'
import { cardLanguage } from '@/lib/collection'
import { focusAfter } from '@/lib/focus'
import { plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import type { CardImage } from '@/types'

/**
 * Les cartes sans image dont la référence donne un code d'extension et un numéro : chercher leurs
 * images d'un coup (une image qui manquait à l'ajout de la carte). `title` : le
 * titre de la section, où va le focus quand toutes sont trouvées (le bouton disparaît).
 */
export function MissingImages({ title }: { title: RefObject<HTMLElement | null> }) {
  const customCards = useCollectionStore((state) => state.collection.customCards)
  const act = useCollectionAction()
  const notify = useNotify()
  const [searching, setSearching] = useState(false)
  const candidates = Object.values(customCards).filter(
    (card) => !card.image && referenceCode(card.reference) !== null,
  )
  if (candidates.length === 0) return null

  const search = async () => {
    setSearching(true)
    // Quatre à la fois : chaque recherche charge une image.
    const images: (CardImage | null)[] = []
    try {
      for (let start = 0; start < candidates.length; start += 4) {
        const batch = candidates.slice(start, start + 4)
        images.push(
          ...(await Promise.all(
            batch.map((card) =>
              findCardImage(card.reference, { lang: cardLanguage(card), retry: true }),
            ),
          )),
        )
      }
    } finally {
      // Même si une recherche échoue : le bouton ne reste pas en chargement.
      setSearching(false)
    }
    const found = candidates.flatMap((card, index) => {
      const image = images[index]
      return image ? [{ id: card.id, image }] : []
    })
    const missing = candidates.length - found.length
    const others = missing ? ` ; introuvable pour ${plural(missing, 'autre', 'autres')}` : ''
    if (found.length === 0) {
      notify(`Pas d’image trouvée pour ${candidates.length > 1 ? 'ces cartes' : 'cette carte'}.`, {
        tone: 'info',
      })
      return
    }
    const apply = () =>
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
    // Toutes trouvées, le bouton disparaît : le focus va au titre de la section.
    if (missing === 0) focusAfter(apply, title)
    else apply()
  }

  return (
    <Stack gap={3} align="start">
      <p>
        {plural(candidates.length, 'carte', 'cartes')} sans image retrouvée :{' '}
        {candidates.length > 1 ? 'leur référence donne' : 'sa référence donne'} un code d’extension
        et un numéro, l’image peut y être cherchée.
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
