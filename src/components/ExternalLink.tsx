import type { AnchorHTMLAttributes } from 'react'

/** Lien vers un autre site, ouvert dans un nouvel onglet : l'app reste ouverte là où on était. */
export function ExternalLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a target="_blank" rel="noreferrer noopener" {...props} />
}
