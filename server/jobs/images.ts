/**
 * Tâche `images` : copie chez nous les images que montre l'app (`server/images.ts`), une fois par
 * jour, après le catalogue.
 * - Les 1 025 Pokémon : sprite et illustration officielle (PokéAPI).
 * - Chaque carte du catalogue : son scan chez Pokécardex, en deux tailles (`md` pour les grilles,
 *   `hd` pour la fiche) ; sinon l'image de son produit TCGplayer ; sinon aucune. Le résultat est
 *   noté (`cards.image`) : l'app sait d'avance quelle image montrer. Une carte sans scan Pokécardex
 *   est recherchée chaque semaine (Pokécardex en ajoute).
 * Seules les images qui manquent sont téléchargées, deux à la fois : Pokécardex prête ses images,
 * on ne l'inonde pas. Le premier passage (environ 1 Go) prend une demi-heure ou plus. En fin de
 * tâche, la réponse de `/api/catalog` est recalculée.
 */

import type { Database } from 'bun:sqlite'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { cardImage, localSrc, tcgplayerImage } from '@/lib/card-images'
import type { CardImage } from '@/types'
import { mirror } from '../images'
import { mapPool } from '../lib/net'
import { saveSnapshot } from '../snapshots'
import { catalogSnapshot } from './catalog'

const WEEK = 7 * 86_400_000

/** Copie les deux tailles d'une image : `true` si la source a les deux. */
const mirrorBoth = async (image: CardImage) =>
  (await mirror(localSrc(image.small))) && (await mirror(localSrc(image.large)))

export async function images(db: Database) {
  const species = Array.from({ length: TOTAL_SPECIES }, (_, index) => index + 1)
  await mapPool(species, 2, async (id) => {
    await mirror(`/images/species/${id}.png`)
    await mirror(`/images/species/artwork/${id}.png`)
  })
  console.log(`Images des ${TOTAL_SPECIES} Pokémon : à jour`)

  // Les cartes jamais cherchées, et celles sans scan Pokécardex cherché il y a plus d'une semaine.
  const weekAgo = new Date(Date.now() - WEEK).toISOString()
  const cards = db
    .query(
      `SELECT key, set_id AS 'set', number, tcgplayer FROM cards
       WHERE image IS NULL OR (image != 'pokecardex' AND image_checked < ?)`,
    )
    .all(weekAgo) as { key: string; set: string; number: string; tcgplayer: number }[]
  const write = db.query('UPDATE cards SET image = ?, image_checked = ? WHERE key = ?')
  const found = { pokecardex: 0, tcgplayer: 0, none: 0 }
  let done = 0
  await mapPool(cards, 2, async ({ key, set, number, tcgplayer }) => {
    // Sans adresse chez Pokécardex : un numéro qui n'en est pas un (« M6a B »).
    const scan = cardImage(`(${set} ${number})`)
    const source =
      scan && (await mirrorBoth(scan))
        ? 'pokecardex'
        : tcgplayer && (await mirrorBoth(tcgplayerImage(tcgplayer)))
          ? 'tcgplayer'
          : 'none'
    // Noté carte par carte : un premier passage interrompu reprend où il en était.
    write.run(source, new Date().toISOString(), key)
    found[source]++
    if (++done % 500 === 0) console.log(`  ${done} / ${cards.length} cartes`)
  })
  console.log(
    `Images de ${cards.length} cartes cherchées : ${found.pokecardex} Pokécardex, ${found.tcgplayer} TCGplayer, ${found.none} sans image`,
  )
  saveSnapshot(db, 'catalog', catalogSnapshot(db))
}
