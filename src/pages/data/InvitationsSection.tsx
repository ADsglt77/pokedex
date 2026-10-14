import { Button, Input, Stack } from '@camply/ui'
import { Copy, Send, Trash2 } from '@camply/ui/icons'
import { useEffect, useState } from 'react'
import { useNotify } from '@/hooks/useNotify'
import { authClient } from '@/lib/auth-client'
import { formatDateTime } from '@/lib/format'
import { DataSection } from './DataSection'
import styles from './DataPage.module.css'

/** Une invitation, telle que la donne le serveur (`server/invitations.ts`). */
interface Invitation {
  token: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  usedEmail: string | null
}

const linkOf = (token: string) => `${location.origin}/inscription?invitation=${token}`

/** « Utilisée par ami@… le 14 octobre 2026 à 10:12 », « Valable jusqu'au … », « Expirée le … ». */
function state({ usedAt, usedEmail, expiresAt }: Invitation) {
  if (usedAt) return `Utilisée par ${usedEmail} le ${formatDateTime(usedAt)}`
  return Date.parse(expiresAt) > Date.now()
    ? `Valable jusqu’au ${formatDateTime(expiresAt)}`
    : `Expirée le ${formatDateTime(expiresAt)}`
}

/**
 * Les invitations, pour un administrateur seulement : l'inscription en exige une. Chacune est un
 * lien à donner, pour une seule inscription, valable 7 jours ; une invitation pas encore utilisée
 * se retire.
 */
export function InvitationsSection() {
  const { data: session } = authClient.useSession()
  const admin = (session?.user as { role?: string } | undefined)?.role === 'admin'
  const notify = useNotify()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [created, setCreated] = useState<string | null>(null)
  // Relue après chaque création ou retrait.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!admin) return
    let current = true
    fetch('/api/invitations', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<Invitation[]>) : null))
      .then((list) => {
        if (current && list) setInvitations(list)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [admin, version])

  if (!admin) return null

  const refresh = () => setVersion((count) => count + 1)
  const create = async () => {
    const response = await fetch('/api/invitations', { method: 'POST' }).catch(() => null)
    if (!response?.ok)
      return notify('Invitation impossible : le serveur ne répond pas.', { tone: 'danger' })
    setCreated(linkOf(((await response.json()) as Invitation).token))
    refresh()
  }
  const copy = async (link: string) => {
    await navigator.clipboard.writeText(link)
    notify('Lien d’invitation copié.')
  }
  const remove = async (token: string) => {
    await fetch(`/api/invitations/${encodeURIComponent(token)}`, { method: 'DELETE' }).catch(
      () => null,
    )
    if (created?.endsWith(token)) setCreated(null)
    refresh()
  }

  return (
    <DataSection id="invitations" title="Invitations">
      <p>
        Personne ne peut créer de compte sans invitation : donnez ce lien à la personne que vous
        invitez. Il sert pour une seule inscription, pendant 7 jours.
      </p>
      <Button variant="soft" leftIcon={<Send size={16} />} onClick={create}>
        Créer une invitation
      </Button>
      {created && (
        <Stack direction="horizontal" align="end" gap={2} className={styles.invitation}>
          <Input
            label="Lien à donner"
            readOnly
            value={created}
            onFocus={(e) => e.target.select()}
          />
          <Button variant="secondary" leftIcon={<Copy size={16} />} onClick={() => copy(created)}>
            Copier
          </Button>
        </Stack>
      )}
      {invitations.length > 0 && (
        <ul className={styles.invitations}>
          {invitations.map((invitation) => (
            <li key={invitation.token}>
              <span>{state(invitation)}</span>
              {!invitation.usedAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  tone="danger"
                  leftIcon={<Trash2 size={14} />}
                  onClick={() => remove(invitation.token)}
                >
                  Retirer
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </DataSection>
  )
}
