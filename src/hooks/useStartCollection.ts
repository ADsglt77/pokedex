import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCollectionAction, useNotify } from '@/hooks/useNotify'
import { forget } from '@/lib/api'
import { loadSetCards, seriesSlot, setCardsUrl, type SetSummary } from '@/lib/card-catalog'
import { seriesPath } from '@/lib/filters'
import { plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'

/**
 * Commencer la collection d'une extension (la page Collections, le Catalogue) : ses cartes
 * chargées (`loadSetCards`), une case chacune (`seriesSlot` ; une carte déjà dans le compte est
 * reprise, `startSeries`), la collection annoncée avec « Annuler », puis sa page ouverte, si
 * l'utilisateur est encore sur celle qui l'a lancée (le composant qui appelle ce hook est toujours
 * là : pas une autre page, ni au Catalogue une autre extension) ; sinon, il reste où il est. La
 * page de la collection l'apprend par l'état de navigation (`started`) : un début annulé avant
 * qu'elle ne s'affiche ramène aux Collections, pas à la page introuvable. Sans ses cartes (l'API
 * ne répond pas) : un message, rien de commencé, et le prochain essai les redemande. `starting` :
 * ses cartes sont en route ; le bouton qui l'a lancée attend (`loading`), un second clic ne la
 * commence pas deux fois (le magasin non plus : `startSeries`).
 */
export function useStartCollection() {
  const act = useCollectionAction()
  const notify = useNotify()
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const startCollection = async (set: SetSummary) => {
    setStarting(true)
    const cards = await loadSetCards(set)
    setStarting(false)
    if (!cards?.length) {
      forget(setCardsUrl(set))
      notify(
        `Collection non commencée : les cartes de ${set.name} ne sont pas disponibles pour le moment. Réessayez dans un instant.`,
        { tone: 'danger' },
      )
      return
    }
    act(
      () =>
        useCollectionStore
          .getState()
          .startSeries(
            { set: set.id, language: set.language, name: set.name },
            cards.map(seriesSlot),
          ),
      `Collection ${set.name} commencée : ${plural(cards.length, 'carte', 'cartes')}.`,
    )
    if (mounted.current) navigate(seriesPath(set.id, set.language), { state: { started: true } })
  }

  return { startCollection, starting }
}
