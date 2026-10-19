import { Badge, DescriptionList, SkeletonText, type BadgeTone } from '@camply/ui'
import { Suspense, use, useState } from 'react'
import { loadStatus } from '@/lib/api'
import { details, formatDate, formatDateTime } from '@/lib/format'
import { DAY, HOUR } from '@/lib/time'
import type { JobState, JobStatus, ServerStatus } from '@/types'
import { DataSection } from './DataSection'
import styles from './DataPage.module.css'

/** Les données que garde le serveur (espèces, cartes, images, prix), et où il en est. */
export function ReferenceSection() {
  // Créée ici, hors de la partie qui attend : elle ne serait sinon jamais la même promesse.
  const [status] = useState(loadStatus)
  return (
    <DataSection
      id="reference"
      title="Données du serveur"
      description="Les espèces, les cartes, leurs images et leurs prix, que garde le serveur, et où il en est."
    >
      <p>
        Les espèces, le catalogue des cartes japonaises de chaque Pokémon (toutes les extensions
        depuis 1996, decks et promos compris : numéro, nom, id Cardmarket) et les images des cartes
        sont gardés par le serveur, qui refait le catalogue quand de nouvelles cartes sortent. Vous
        y choisissez vos cartes, ou les saisissez : l’image est alors retrouvée d’après la référence
        (le code de l’extension et le numéro), ou c’est celle de l’adresse que vous collez. Leur
        prix vient de leur id Cardmarket : celui du guide quotidien de Cardmarket, relu chaque jour
        par le serveur, qui en garde l’historique carte par carte.
      </p>
      <Suspense fallback={<SkeletonText lines={5} className={styles.jobs} />}>
        <JobsStatus status={status} />
      </Suspense>
    </DataSection>
  )
}

/** Le badge de chaque état d'une tâche. */
const STATES: Record<JobState, { tone: BadgeTone; badge: string }> = {
  ok: { tone: 'success', badge: 'À jour' },
  late: { tone: 'warn', badge: 'En retard' },
  failed: { tone: 'danger', badge: 'En échec' },
  never: { tone: 'neutral', badge: 'Jamais passée' },
  frozen: { tone: 'warn', badge: 'Figés' },
}

/** « Chaque jour », « Toutes les 6 h », « À la demande ». */
function rhythm(every: number | null) {
  if (every === null) return 'À la demande'
  if (every < DAY) return `Toutes les ${every / HOUR} h`
  return every === DAY ? 'Chaque jour' : `Tous les ${every / DAY} jours`
}

/** Ce qu'on sait d'une tâche : son rythme, ses dates, et pour les prix, leur jour. */
function describeJob(job: JobStatus, pricesDate: string | null) {
  const since = job.lastSuccess && `dernière réussite le ${formatDateTime(job.lastSuccess)}`
  return details(
    rhythm(job.every),
    job.job === 'prices' && pricesDate && `prix du ${formatDate(pricesDate)}`,
    job.state === 'failed' && `dernier essai le ${formatDateTime(job.lastRun)}`,
    since || (job.state === 'failed' && 'aucune réussite'),
    job.state === 'frozen' && 'le guide de Cardmarket n’a pas changé depuis plus de deux jours',
  )
}

function JobsStatus({ status }: { status: Promise<ServerStatus | null> }) {
  const current = use(status)
  if (!current) {
    return (
      <p className="muted">
        L’état des données est inconnu : le serveur des données ne répond pas, ou il n’est pas à
        jour.
      </p>
    )
  }
  return (
    <DescriptionList
      className={styles.jobs}
      divided
      items={current.jobs.map((job) => ({
        term: job.label,
        description: (
          <span className={styles.job}>
            <Badge size="sm" tone={STATES[job.state].tone}>
              {STATES[job.state].badge}
            </Badge>
            <span className="muted">{describeJob(job, current.pricesDate)}</span>
          </span>
        ),
      }))}
    />
  )
}
