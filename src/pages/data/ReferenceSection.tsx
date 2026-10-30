import { Alert } from '@camply/ui'
import { Suspense, use, useState } from 'react'
import { loadStatus } from '@/lib/api'
import type { JobState, ServerStatus } from '@/types'
import { DataSection } from './DataSection'

const STATE_LABELS: Record<Extract<JobState, 'late' | 'failed' | 'frozen'>, string> = {
  late: 'en retard',
  failed: 'la dernière mise à jour a échoué',
  frozen: 'prix figés',
}

type ProblemState = keyof typeof STATE_LABELS
type Job = ServerStatus['jobs'][number]

/** Une tâche en retard, en échec ou figée : ce que montre le site risque de ne pas être à jour. */
const isProblem = (job: Job): job is Job & { state: ProblemState } =>
  Object.hasOwn(STATE_LABELS, job.state)

/**
 * Silencieux quand tout va bien ; un panneau n'apparaît que si des données du site risquent de ne
 * pas être à jour. Pour l'utilisateur, pas pour l'administrateur : ce qui est touché, sans
 * consigne d'exploitation.
 */
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
  // `undefined` : l'état n'a pas pu être lu (l'alerte le dit) ; vide : tout va bien, rien à dire.
  const problems = use(status)?.jobs.filter(isProblem)
  if (problems?.length === 0) return null

  return (
    <DataSection id="reference" title="Données du site">
      <Alert
        tone={problems?.some((job) => job.state === 'failed') ? 'danger' : 'warn'}
        title="Certaines données peuvent ne pas être à jour"
      >
        {problems ? (
          <>
            <ul>
              {problems.map((job) => (
                <li key={job.job}>
                  {job.label}&nbsp;: {STATE_LABELS[job.state]}.
                </li>
              ))}
            </ul>
            <p>Elles seront mises à jour dès que possible&#8239;; réessayez plus tard.</p>
          </>
        ) : (
          <>Leur état ne peut pas être lu pour le moment&nbsp;: réessayez plus tard.</>
        )}
      </Alert>
    </DataSection>
  )
}
