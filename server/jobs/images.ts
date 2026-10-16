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
 * on ne l'inonde pas. Le premier passage (environ 1,5 Go) prend une heure ou plus. Une image en
 * erreur (panne, réponse qui n'est pas une image) n'empêche pas les autres : rien n'est noté pour
 * elle, la tâche échoue à la fin pour être relancée, et l'image est redemandée. À la 20e
 * erreur, la source est sans doute en panne : la tâche s'arrête là. En fin de tâche, même
 * arrêtée, la réponse de `/api/catalog` est recalculée.
 */

import type { Database } from 'bun:sqlite'
import { SPECIES_IDS, TOTAL_SPECIES } from '@/config/pokedex'
import { localSrc, pokecardexImage } from '@/lib/card-images'
import { WEEK } from '@/lib/time'
import { mirror } from '../images'
import { mapPool } from '../lib/net'
import { saveCatalog } from './catalog'

/** Au-delà, la source est sans doute en panne : on ne la sollicite pas davantage. */
const MAX_FAILURES = 20

export async function images(db: Database) {
  const failed: string[] = []
  /** Copie une image : `true`, `false` si la source ne l'a pas, `null` en erreur. */
  const copy = async (path: string) => {
    try {
      return await mirror(path)
    } catch (error) {
      failed.push(path)
      console.warn(`  ${path} :`, error instanceof Error ? error.message : error)
      if (failed.length >= MAX_FAILURES) {
        throw new Error(`${failed.length} images en erreur : la source est sans doute en panne`, {
          cause: error,
        })
      }
      return null
    }
  }

  try {
    await mapPool(SPECIES_IDS, 2, async (id) => {
      await copy(`/images/species/${id}.png`)
      await copy(`/images/species/artwork/${id}.png`)
    })
    console.log(`Images des ${TOTAL_SPECIES} Pokémon : vérifiées`)

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
      const copied = (await copy(localSrc(small))) && (await copy(localSrc(large)))
      // Noté carte par carte : un premier passage interrompu reprend où il en était. En erreur,
      // rien n'est noté : la carte est cherchée de nouveau au prochain passage.
      if (copied !== null) write.run(copied ? 'pokecardex' : 'none', new Date().toISOString(), id)
      if (copied) found++
      if (++done % 500 === 0) console.log(`  ${done} / ${cards.length} cartes`)
    })
    console.log(`Images de ${cards.length} cartes cherchées : ${found} chez Pokécardex`)
  } finally {
    saveCatalog(db)
  }
  if (failed.length) {
    throw new Error(
      `${failed.length} images en erreur, redemandées au prochain passage (${failed.slice(0, 5).join(', ')})`,
    )
  }
}
