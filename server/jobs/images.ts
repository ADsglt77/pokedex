/**
 * Tâche `images` : copie chez nous les images que montre l'app (`server/images.ts`), une fois par
 * jour, après le catalogue. Pokécardex prête les siennes à condition qu'elles soient hébergées
 * chez nous, jamais affichées depuis ses serveurs.
 * - Les 1 025 Pokémon : sprite et illustration officielle (PokéAPI).
 * - Chaque carte du catalogue : son scan chez Pokécardex, en deux tailles (`md` pour les grilles,
 *   `hd` pour la fiche), ou aucun. Le résultat est noté (`cards.image`) : l'app sait d'avance
 *   quelle carte n'a pas d'image. Une carte sans scan est recherchée chaque semaine (Pokécardex en
 *   ajoute).
 * Seules les images qui manquent sont téléchargées, deux à la fois : Pokécardex prête ses images,
 * on ne l'inonde pas. Le premier passage (environ 1 Go) prend une heure ou plus. En fin de tâche,
 * la réponse de `/api/catalog` est recalculée.
 */

import type { Database } from 'bun:sqlite'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { localSrc, pokecardexImage } from '@/lib/card-images'
import { mirror } from '../images'
import { mapPool } from '../lib/net'
import { saveSnapshot } from '../snapshots'
import { catalogSnapshot } from './catalog'

const WEEK = 7 * 86_400_000

export async function images(db: Database) {
  const species = Array.from({ length: TOTAL_SPECIES }, (_, index) => index + 1)
  await mapPool(species, 2, async (id) => {
    await mirror(`/images/species/${id}.png`)
    await mirror(`/images/species/artwork/${id}.png`)
  })
  console.log(`Images des ${TOTAL_SPECIES} Pokémon : à jour`)

  // Les cartes jamais cherchées, et celles sans scan cherché il y a plus d'une semaine.
  const weekAgo = new Date(Date.now() - WEEK).toISOString()
  const cards = db
    .query(
      `SELECT id, set_id AS 'set', sort FROM cards
       WHERE image IS NULL OR (image = 'none' AND image_checked < ?)`,
    )
    .all(weekAgo) as { id: number; set: string; sort: number }[]
  const write = db.query('UPDATE cards SET image = ?, image_checked = ? WHERE id = ?')
  let found = 0
  let done = 0
  await mapPool(cards, 2, async ({ id, set, sort }) => {
    const { small, large } = pokecardexImage(set, sort)
    const copied = (await mirror(localSrc(small))) && (await mirror(localSrc(large)))
    // Noté carte par carte : un premier passage interrompu reprend où il en était.
    write.run(copied ? 'pokecardex' : 'none', new Date().toISOString(), id)
    if (copied) found++
    if (++done % 500 === 0) console.log(`  ${done} / ${cards.length} cartes`)
  })
  console.log(`Images de ${cards.length} cartes cherchées : ${found} chez Pokécardex`)
  saveSnapshot(db, 'catalog', catalogSnapshot(db))
}
