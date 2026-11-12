import type { AnchorHTMLAttributes } from 'react'

/**
 * Lien vers un autre site, ouvert dans un nouvel onglet : l'app reste ouverte là où on était. Les
 * lecteurs d'écran l'apprennent avant de le suivre (« nouvel onglet », masqué à l'écran).
 */
export function ExternalLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a target="_blank" rel="noreferrer noopener" {...props}>
      {children}
      <span className="visually-hidden"> (nouvel onglet)</span>
    </a>
  )
}
