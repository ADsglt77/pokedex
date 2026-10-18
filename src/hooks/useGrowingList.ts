import { useEffect, useRef, useState } from 'react'

/**
 * Une longue liste dessinée au fur et à mesure (grilles du catalogue, extensions) : `step` éléments
 * d'abord, puis `step` de plus chaque fois que sa fin approche à l'écran. `sentinel` : un repère à
 * poser en bas de la liste, haut d'un écran (classe `growing-sentinel`, dans un parent
 * `position: relative`) : il paraît un écran avant la fin. Moins d'éléments dans la page : elle
 * s'ouvre, se ferme et défile vite, même pour des centaines de cartes. Une autre liste (une autre
 * extension) repart de `step` en remontant le composant (`key`).
 */
export function useGrowingList(total: number, step: number) {
  const [limit, setLimit] = useState(step)
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
  return { limit, sentinel, more: limit < total }
}
