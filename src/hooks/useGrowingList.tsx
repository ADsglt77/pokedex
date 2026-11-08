import { useEffect, useRef, useState } from 'react'

/** Les longueurs des listes nommées d'une entrée de l'historique, gardées dans son état. */
interface GrownState {
  grown?: Record<string, number>
}

/** La longueur que la liste `name` avait dans cette entrée de l'historique ; 0 sans. */
const grownTo = (name: string) => (history.state as GrownState | null)?.grown?.[name] ?? 0

/**
 * Une longue liste dessinée au fur et à mesure (grilles du catalogue, extensions) : `step` éléments
 * d'abord, puis `step` de plus chaque fois que sa fin approche à l'écran. `end` : le repère à poser
 * en bas de la liste (`null` une fois toute dessinée), haut d'un écran (classe `growing-sentinel`,
 * dans un parent `position: relative`) : il paraît un écran avant la fin. Moins d'éléments dans la
 * page : elle s'ouvre, se ferme et défile vite, même pour des centaines de cartes. Une autre liste
 * (une autre extension) repart de `step` en remontant le composant (`key`). `atLeast` (lu au
 * premier rendu seulement) : les éléments à dessiner d'emblée, arrondis au palier (la carte ouverte
 * d'emblée d'une collection, dont la tuile reprend le focus à la fermeture de sa fenêtre). `name` :
 * la liste d'une page qu'on quitte par ses liens (la liste d'achats…) ; sa longueur est gardée dans
 * l'entrée de l'historique (son état, comme sa clé : `main.tsx`), et « Précédent » ou un
 * rechargement la redessine aussi longue : la position de défilement (`ScrollRestoration`) et le
 * lien suivi (`returnedLink`) y sont encore.
 */
export function useGrowingList(total: number, step: number, atLeast = 0, name?: string) {
  const [limit, setLimit] = useState(() => {
    const wanted = Math.max(atLeast, name ? grownTo(name) : 0)
    return Math.max(step, Math.ceil(wanted / step) * step)
  })
  const sentinel = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const target = sentinel.current
    if (!target || limit >= total) return
    // Recréé à chaque palier : s'il paraît encore (grand écran), le palier suivant vient aussitôt.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setLimit((current) => current + step)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [limit, total, step])
  useEffect(() => {
    if (!name || limit <= Math.max(step, grownTo(name))) return
    const state = history.state as GrownState | null
    history.replaceState({ ...state, grown: { ...state?.grown, [name]: limit } }, '')
  }, [name, limit, step])
  return {
    limit,
    end:
      limit < total ? (
        <span ref={sentinel} className="growing-sentinel" aria-hidden="true" />
      ) : null,
  }
}
