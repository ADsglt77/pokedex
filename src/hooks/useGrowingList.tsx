import { useEffect, useRef, useState } from 'react'

/**
 * Une longue liste dessinée au fur et à mesure (grilles du catalogue, extensions) : `step` éléments
 * d'abord, puis `step` de plus chaque fois que sa fin approche à l'écran. `end` : le repère à poser
 * en bas de la liste (`null` une fois toute dessinée), haut d'un écran (classe `growing-sentinel`,
 * dans un parent `position: relative`) : il paraît un écran avant la fin. Moins d'éléments dans la
 * page : elle s'ouvre, se ferme et défile vite, même pour des centaines de cartes. Une autre liste
 * (une autre extension) repart de `step` en remontant le composant (`key`). `atLeast` (lu au
 * premier rendu seulement) : les éléments à dessiner d'emblée, arrondis au palier (la carte ouverte
 * d'emblée d'une collection, dont la tuile reprend le focus à la fermeture de sa fenêtre).
 */
export function useGrowingList(total: number, step: number, atLeast = 0) {
  const [limit, setLimit] = useState(() => Math.max(step, Math.ceil(atLeast / step) * step))
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
  return {
    limit,
    end:
      limit < total ? (
        <span ref={sentinel} className="growing-sentinel" aria-hidden="true" />
      ) : null,
  }
}
