import { Alert } from '@camply/ui'
import { Suspense, use, useState } from 'react'
import { loadStatus } from '@/lib/api'
import type { JobState, ServerStatus } from '@/types'
import { DataSection } from './DataSection'

const STATE_LABELS: Record<Extract<JobState, 'late' | 'failed' | 'frozen'>, string> = {
  late: 'en retard',
  failed: 'échec de la dernière mise à jour',
  frozen: 'prix figés',
}

type ProblemState = keyof typeof STATE_LABELS

const isProblem = <Job extends { state: JobState }>(
  job: Job,
): job is Job & { state: ProblemState } => Object.hasOwn(STATE_LABELS, job.state)

/** Silencieux quand tout va bien ; un panneau n'apparaît que si les données posent problème. */
export function ReferenceSection() {
  // Créée ici, hors de la partie qui attend : elle ne serait sinon jamais la même promesse.
  const [status] = useState(loadStatus)
  return (
    <Suspense fallback={null}>
      <ServerAlert status={status} />
    </Suspense>
  )
}

function ServerAlert({ status }: { status: Promise<ServerStatus | null> }) {
  const current = use(status)
  if (!current) {
    return (
      <DataSection id="reference" title="Données du serveur">
        <Alert tone="warn" title="L’état des données est inconnu">
          Le serveur ne répond pas pour le moment. Réessayez plus tard ; si le problème persiste,
          vérifiez le service d’ingestion.
        </Alert>
      </DataSection>
    )
  }

  const problems = current.jobs.filter(isProblem)
  if (problems.length === 0) return null

  const failed = problems.some((job) => job.state === 'failed')
  return (
    <DataSection id="reference" title="Données du serveur">
      <Alert
        tone={failed ? 'danger' : 'warn'}
        title={
          problems.length === 1
            ? 'Une source doit être vérifiée'
            : 'Des sources doivent être vérifiées'
        }
      >
        <ul>
          {problems.map((job) => (
            <li key={job.job}>
              {job.label} : {STATE_LABELS[job.state]}.
            </li>
          ))}
        </ul>
        <p>Relancez l’ingestion concernée, puis actualisez cette page.</p>
      </Alert>
    </DataSection>
  )
}
