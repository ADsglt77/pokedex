import { Alert, Button, EmptyState, Stack } from '@camply/ui'
import { WalletCards } from '@camply/ui/icons'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { CardArt } from '@/components/CardArt'
import { PokedexTile } from '@/components/PokedexTile'
import { ProgressRuler } from '@/components/ProgressRuler'
import { usePokedex } from '@/hooks/usePokedex'
import { useWishlist } from '@/hooks/useWishlist'
import { isToBuy } from '@/lib/collection'
import { cardTitle } from '@/lib/species'
import { pokedexUrl } from '@/lib/filters'
import { formatDate, formatInteger, pageTitle, plural, today, unlockedOf } from '@/lib/format'
import { recentAcquisitions, summarize, type Progress, type RecentCard } from '@/lib/pokedex'
import { isUnderMax } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import styles from './HomePage.module.css'

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

/** L'accueil : la progression en une phrase et par génération, puis les dernières cartes obtenues. */
export function HomePage() {
  const pokedex = usePokedex()
  const collection = useCollectionStore((state) => state.collection)
  const recent = useMemo(() => recentAcquisitions(collection, 6), [collection])
  const { ordered, wanted } = summarize(collection)
  const [unlockedText, remainingText] = progressSentence(pokedex.progress)
  const tracking = trackingSentence(ordered, wanted)
  const month = today().slice(0, 7)
  const thisMonth = Object.values(collection.cards).filter(
    (ownership) => ownership.status === 'owned' && ownership.acquiredAt?.startsWith(month),
  ).length

  return (
    <div className="container">
      <title>{pageTitle()}</title>

      <Stack as="section" gap={5} align="start" className={styles.hero}>
        <h1 className={styles.title}>Mon Pokédex</h1>
        <p className={styles.sentence}>
          <span>{unlockedText}</span>
          <span className="muted">{remainingText}</span>
          {thisMonth > 0 && (
            <span className="muted">
              {plural(thisMonth, 'carte obtenue', 'cartes obtenues')} ce mois-ci.
            </span>
          )}
        </p>
        <UnderMaxNotice />
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
              <Link to={pokedexUrl({ generation: generation.id })} className={styles.region}>
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

/**
 * Les cartes de la liste d'achats dont le prix du marché est passé sous le prix maximum. Les prix
 * ne sont chargés que si une carte de la liste a un prix maximum.
 */
function UnderMaxNotice() {
  const watching = useShoppingStore((state) =>
    Object.values(state.shopping.preferences).some(
      (preference) => preference.decision === 'accepted' && preference.maxPrice !== undefined,
    ),
  )
  return watching ? <UnderMaxCount /> : null
}

function UnderMaxCount() {
  const { rows } = useWishlist()
  const count = rows.filter((row) => isToBuy(row) && isUnderMax(row)).length
  if (count === 0) return null
  return (
    <Alert tone="success" title={`${plural(count, 'carte', 'cartes')} sous votre prix maximum`}>
      Le prix du marché Cardmarket est passé sous le maximum que vous vous êtes fixé.{' '}
      <Link to="/achats">Voir la liste d’achats</Link>
    </Alert>
  )
}

function RecentCards({ cards }: { cards: RecentCard[] }) {
  return (
    <Stack as="section" gap={6} className={styles.section} aria-labelledby="recent-title">
      <h2 id="recent-title">Dernières cartes obtenues</h2>
      <ul className={styles.recent}>
        {cards.map((recent, index) => {
          const speciesId = recent.card.dexIds[0]!
          const date = formatDate(recent.acquiredAt)
          return (
            <li
              key={recent.card.id}
              className={styles.dealt}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <Link to={`/pokemon/${speciesId}`} className={styles.recentCard}>
                <CardArt card={recent.card} speciesId={speciesId} alt="" eager />
                <span className={styles.recentName}>{cardTitle(recent.card)}</span>
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

/** Tant qu'aucune carte n'est obtenue : comment commencer, et les premières cartes ajoutées. */
function FirstCards() {
  const pokedex = usePokedex()
  const teaser = pokedex.entries.filter((entry) => entry.card?.card.image).slice(0, 5)

  return (
    <Stack as="section" gap={6} className={styles.section}>
      <EmptyState
        headingLevel={2}
        icon={<WalletCards size={22} />}
        title="Aucune carte obtenue pour l’instant"
        description="Ouvrez un Pokémon, ajoutez la carte que vous voulez, puis indiquez « Je possède cette carte » quand vous l’avez. Elle apparaît ici et le Pokémon est débloqué."
      />
      {teaser.length > 0 && (
        <>
          <h2>Vos cartes à obtenir</h2>
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
