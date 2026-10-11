import { Button, EmptyState, Stack } from '@camply/ui'
import { WalletCards } from '@camply/ui/icons'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { CardArt } from '@/components/CardArt'
import { PokedexTile } from '@/components/PokedexTile'
import { ProgressRuler } from '@/components/ProgressRuler'
import { usePokedex } from '@/hooks/usePokedex'
import { summarize } from '@/lib/collection'
import { formatDate, formatInteger, pageTitle, plural, unlockedOf } from '@/lib/format'
import { recentAcquisitions, type Progress, type RecentCard } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import styles from './HomePage.module.css'

const listFormat = new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' })

/** Quelques belles illustrations à débloquer, montrées tant qu'aucune carte n'est obtenue. */
const TEASER_SPECIES = [25, 6, 150, 151, 94, 448, 133, 197]

function progressSentence(progress: Progress) {
  const { unlocked, missing, total } = progress
  if (unlocked === 0) {
    return [
      'Aucun Pokémon débloqué pour l’instant.',
      `Les ${formatInteger(total)} restent à trouver.`,
    ]
  }
  if (missing === 0)
    return [`Les ${formatInteger(total)} Pokémon sont débloqués.`, 'Le Pokédex est complet.']
  return [
    `${unlockedOf(progress, 'Pokémon')}.`,
    missing === 1
      ? 'Il n’en reste qu’un à trouver.'
      : `Il en reste ${formatInteger(missing)} à trouver.`,
  ]
}

function trackingSentence(ordered: number, wanted: number): string | null {
  const orderedText = plural(ordered, 'carte commandée', 'cartes commandées')
  if (ordered > 0 && wanted > 0)
    return `${orderedText}, ${plural(wanted, 'souhaitée', 'souhaitées')}.`
  if (ordered > 0) return `${orderedText}.`
  if (wanted > 0) return `${plural(wanted, 'carte souhaitée', 'cartes souhaitées')}.`
  return null
}

export function HomePage() {
  const pokedex = usePokedex()
  const collection = useCollectionStore((state) => state.collection)
  const recent = useMemo(() => recentAcquisitions(collection, 6), [collection])
  const { ordered, wanted } = summarize(collection)
  const [unlockedText, remainingText] = progressSentence(pokedex.progress)
  const tracking = trackingSentence(ordered, wanted)

  return (
    <div className="container">
      <title>{pageTitle()}</title>

      <Stack as="section" gap={5} align="start" className={styles.hero}>
        <h1 className={styles.title}>Mon Pokédex</h1>
        <p className={styles.sentence}>
          <span>{unlockedText}</span>
          <span className="muted">{remainingText}</span>
        </p>
        <Button asChild size="lg" className={styles.cta}>
          <Link to="/pokedex">Ouvrir le Pokédex</Link>
        </Button>
      </Stack>

      <Stack as="section" gap={4} className={styles.progress} aria-labelledby="progress-title">
        <h2 id="progress-title" className="visually-hidden">
          Progression par génération
        </h2>
        <div className={styles.ruler}>
          <ProgressRuler generations={pokedex.generations} />
        </div>
        <ul className={styles.regions}>
          {pokedex.generations.map(({ generation, unlocked, total }) => (
            <li key={generation.id}>
              <Link to={`/pokedex?generation=${generation.id}`} className={styles.region}>
                <span>{generation.region}</span>
                <span className="muted numeric">
                  {formatInteger(unlocked)} sur {formatInteger(total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {tracking && <p className="muted">{tracking}</p>}
      </Stack>

      {recent.length > 0 ? <RecentCards cards={recent} /> : <FirstCards />}
    </div>
  )
}

function RecentCards({ cards }: { cards: RecentCard[] }) {
  return (
    <Stack as="section" gap={6} className={styles.section} aria-labelledby="recent-title">
      <h2 id="recent-title" className={styles.sectionTitle}>
        Dernières cartes obtenues
      </h2>
      <ul className={styles.recent}>
        {cards.map((recent, index) => {
          const speciesId = recent.species[0]?.id ?? recent.card.dexIds[0] ?? 0
          const name = listFormat.format(recent.species.map((species) => species.names.fr))
          const date = formatDate(recent.acquiredAt)
          return (
            <li
              key={recent.card.id}
              className={styles.dealt}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <Link to={`/pokemon/${speciesId}`} className={styles.recentCard}>
                <CardArt
                  image={recent.image}
                  hasCard
                  speciesId={speciesId}
                  reference={recent.card.reference}
                  alt=""
                  eager
                />
                <span className={styles.recentName}>{name}</span>
                <span className="muted">{recent.card.reference}</span>
                {date && <span className={styles.recentDate}>Obtenue le {date}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </Stack>
  )
}

function FirstCards() {
  const pokedex = usePokedex()
  const teaser = TEASER_SPECIES.flatMap((id) => pokedex.entryById.get(id) ?? [])
    .filter((entry) => entry.image !== null && !entry.unlocked)
    .slice(0, 5)
    .sort((a, b) => a.species.id - b.species.id)

  return (
    <Stack as="section" gap={6} className={styles.section}>
      <EmptyState
        headingLevel={2}
        icon={<WalletCards size={22} />}
        title="Aucune carte obtenue pour l’instant"
        description="Ouvrez un Pokémon, choisissez une illustration, puis indiquez « Je possède cette carte ». La carte apparaît ici et le Pokémon est débloqué."
      />
      {teaser.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Quelques illustrations à débloquer</h2>
          <ul className={styles.teaser}>
            {teaser.map((entry) => (
              <li key={entry.species.id}>
                <PokedexTile entry={entry} eager />
              </li>
            ))}
          </ul>
        </>
      )}
    </Stack>
  )
}
