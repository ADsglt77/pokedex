import { Badge, DescriptionList, SkeletonText, type BadgeTone } from '@camply/ui'
import { Suspense, use, useState, type ReactNode } from 'react'
import { ExternalLink } from '@/components/ExternalLink'
import { INGEST_JOB_NAMES, INGEST_JOBS, type IngestJob } from '@/config/jobs'
import { isOverdue } from '@/lib/jobs'
import { details, formatDate, formatDateTime } from '@/lib/format'
import { settled } from '@/lib/settled'
import type { JobStatus, ServerStatus } from '@/types'
import { DataSection } from './DataSection'
import styles from './DataPage.module.css'

/**
 * L'état des tâches du serveur, demandé à chaque ouverture de la page ; `null` s'il ne répond pas,
 * ou s'il n'est pas de la même version que le site (pas encore redémarré après une mise à jour).
 */
const loadStatus = () =>
  settled(
    fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      .then((response) => (response.ok ? (response.json() as Promise<ServerStatus>) : null))
      .then((status) => (status?.jobs ? status : null))
      .catch(() => null),
  )

/** D'où viennent les données, et où en est le serveur qui les relit. */
export function ReferenceSection() {
  // Créée ici, hors de la partie qui attend : elle ne serait sinon jamais la même promesse.
  const [status] = useState(loadStatus)
  return (
    <DataSection
      id="reference"
      title="Sources des données"
      description="D’où viennent les espèces, les cartes, leurs images et leurs prix, et où en est le serveur qui les relit."
    >
      <p>
        Les espèces viennent de <ExternalLink href="https://pokeapi.co/">PokéAPI</ExternalLink>,
        gardées par le serveur. Le catalogue des cartes japonaises de chaque Pokémon (toutes les
        extensions depuis 1996, decks et promos compris : numéro, nom, id Cardmarket), refait chaque
        jour par le serveur, vient de{' '}
        <ExternalLink href="https://www.pokecardex.com/">Pokécardex</ExternalLink>, avec son aimable
        autorisation, comme les images des cartes, copiées sur notre serveur. Vous y choisissez vos
        cartes, ou les saisissez : l’image est alors retrouvée d’après la référence (le code de
        l’extension et le numéro), ou c’est celle de l’adresse que vous collez. Leur prix vient de
        leur id Cardmarket : celui du guide quotidien de{' '}
        <ExternalLink href="https://www.cardmarket.com/">Cardmarket</ExternalLink>, relu chaque jour
        par le serveur, qui en garde l’historique carte par carte.
      </p>
      <p>
        Le serveur relit chaque source à son rythme. En développement, une source se relit avec{' '}
        <code>bun run ingest &lt;tâche&gt;</code>.
      </p>
      <Suspense fallback={<SkeletonText lines={5} className={styles.jobs} />}>
        <JobsStatus status={status} />
      </Suspense>
    </DataSection>
  )
}

/** Où en est une tâche : un badge et une phrase. `now` : en ms. */
function describeJob(
  job: IngestJob,
  status: JobStatus | undefined,
  now: number,
): { tone: BadgeTone; badge: string; text: ReactNode } {
  const { optional } = INGEST_JOBS[job]
  const success = status?.lastSuccess ?? null
  const since = success && `Dernière réussite le ${formatDateTime(success)}`
  if (!status?.lastRun) {
    return optional
      ? {
          tone: 'neutral',
          badge: 'Facultatif',
          text: 'Jamais passée : le serveur copie à la demande les images affichées.',
        }
      : {
          tone: 'warn',
          badge: 'À lancer',
          text: (
            <>
              Jamais passée (en développement : <code>bun run ingest {job}</code>).
            </>
          ),
        }
  }
  if (status.lastRun !== success) {
    return {
      tone: 'danger',
      badge: 'En échec',
      text: details(
        `Dernier essai le ${formatDateTime(status.lastRun)}`,
        since || 'aucune réussite',
      ),
    }
  }
  if (isOverdue(job, success, now)) {
    return { tone: 'warn', badge: 'En retard', text: since }
  }
  return { tone: 'success', badge: 'À jour', text: since }
}

function JobsStatus({ status }: { status: Promise<ServerStatus | null> }) {
  const current = use(status)
  const [now] = useState(() => Date.now())
  if (!current) {
    return (
      <p className="muted">
        L’état des données est inconnu : le serveur ne répond pas, ou il n’est pas à jour
        (redémarrez-le).
      </p>
    )
  }
  return (
    <DescriptionList
      className={styles.jobs}
      divided
      items={INGEST_JOB_NAMES.map((job) => {
        const { tone, badge, text } = describeJob(job, current.jobs[job], now)
        // Le jour des prix, qui peut précéder celui de leur relevé.
        const pricesDate =
          job === 'prices' && current.pricesDate && `Prix du ${formatDate(current.pricesDate)}. `
        return {
          term: INGEST_JOBS[job].label,
          description: (
            <span className={styles.job}>
              <Badge size="sm" tone={tone}>
                {badge}
              </Badge>
              <span className="muted">
                {pricesDate}
                {text}
              </span>
            </span>
          ),
        }
      })}
    />
  )
}
