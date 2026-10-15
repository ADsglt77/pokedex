import { Button, DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from '@camply/ui'
import { CloudAlert, CloudCheck, CloudOff, LogIn, LogOut, RefreshCw } from '@camply/ui/icons'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SyncConflictDialog } from '@/components/SyncConflictDialog'
import { useNotify } from '@/hooks/useNotify'
import { authClient, loginPath } from '@/lib/auth-client'
import { cx } from '@/lib/cx'
import {
  hasUnsentChanges,
  setConflictQuestion,
  setSyncUser,
  signOut,
  sync,
  useSyncStore,
  type SyncStatus,
} from '@/store/sync'
import styles from './AccountMenu.module.css'

/** Où en est la synchronisation : le bouton du compte, et sa phrase dans le menu. */
const STATUS: Record<
  Exclude<SyncStatus, 'local'>,
  { label: string; icon: typeof CloudCheck; text: string }
> = {
  syncing: {
    label: 'Synchronisation…',
    icon: RefreshCw,
    text: 'Envoi ou réception de votre collection en cours.',
  },
  synced: {
    label: 'Synchronisée',
    icon: CloudCheck,
    text: 'Votre collection est la même sur tous vos appareils.',
  },
  offline: {
    label: 'Hors ligne',
    icon: CloudOff,
    text: 'Le serveur ne répond pas : vos modifications restent sur cet appareil et partiront à son retour.',
  },
  expired: {
    label: 'Reconnectez-vous',
    icon: CloudAlert,
    text: 'Vous êtes déconnecté (session expirée, ou connexion sur un autre appareil : un seul à la fois) : vos modifications restent sur cet appareil.',
  },
  conflict: {
    label: 'À choisir',
    icon: CloudAlert,
    text: 'Cet appareil et le serveur ont chacun modifié la collection : choisissez celle à garder.',
  },
  refused: {
    label: 'Envoi refusé',
    icon: CloudAlert,
    text: 'Le serveur refuse cette collection (abîmée ?) : exportez-la depuis la page Données.',
  },
}

/**
 * Le compte : « Se connecter » ; connecté, l'état de la synchronisation et un menu (synchroniser,
 * se reconnecter, se déconnecter). Il suit la session pour la synchronisation (`setSyncUser`) et
 * ouvre la question d'un conflit : un seul dans la page. En bas de la barre latérale, de sa largeur ;
 * `compact` (barre du haut), son icône seule (le texte reste lu).
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { data: session, isPending } = authClient.useSession()
  const status = useSyncStore((state) => state.status)
  const conflict = useSyncStore((state) => state.conflict)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  // Après la connexion, retour à la page ouverte, filtres compris.
  const login = loginPath(pathname + search)
  const notify = useNotify()
  const dismissed = useSyncStore((state) => state.dismissed)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!isPending) setSyncUser(userId)
  }, [isPending, userId])

  if (isPending) return null
  if (!session) {
    return pathname === '/connexion' ? null : (
      <Button
        asChild
        size="sm"
        variant="ghost"
        leftIcon={<LogIn size={16} />}
        className={cx(!compact && styles.wide)}
      >
        <Link to={login}>
          <span className={cx(compact && 'visually-hidden')}>Se connecter</span>
        </Link>
      </Button>
    )
  }

  // Juste connecté, la synchronisation n'a pas encore commencé.
  const shown = status === 'local' ? 'syncing' : status
  const { label, icon: Icon, text } = STATUS[shown]
  const leave = async () => {
    if (await signOut()) {
      notify('Vous êtes déconnecté : votre collection reste sur le serveur.', { tone: 'info' })
    } else {
      notify('Déconnexion impossible : le serveur ne répond pas.', { tone: 'danger' })
    }
  }

  return (
    <>
      <DropdownMenu
        placement={compact ? 'bottom-end' : 'top-start'}
        trigger={
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Icon size={16} />}
            className={cx(
              !compact && styles.wide,
              shown !== 'synced' && shown !== 'syncing' && styles.alert,
            )}
          >
            <span className={cx(compact && 'visually-hidden')}>{label}</span>
          </Button>
        }
      >
        <MenuLabel className={styles.email}>{session.user.email}</MenuLabel>
        <MenuLabel className={styles.text}>{text}</MenuLabel>
        <MenuSeparator />
        {status === 'conflict' && (
          <MenuItem onSelect={() => setConflictQuestion(true)}>
            Choisir la version à garder
          </MenuItem>
        )}
        {status === 'expired' ? (
          <MenuItem icon={<LogIn size={16} />} onSelect={() => navigate(login)}>
            Se reconnecter
          </MenuItem>
        ) : (
          <MenuItem icon={<RefreshCw size={16} />} onSelect={() => void sync()}>
            Synchroniser maintenant
          </MenuItem>
        )}
        <MenuItem
          icon={<LogOut size={16} />}
          onSelect={async () => {
            if (await hasUnsentChanges()) setConfirmingSignOut(true)
            else await leave()
          }}
        >
          Se déconnecter
        </MenuItem>
      </DropdownMenu>

      <SyncConflictDialog
        open={status === 'conflict' && conflict !== dismissed}
        onClose={() => setConflictQuestion(false)}
      />
      <ConfirmDialog
        open={confirmingSignOut}
        title="Se déconnecter quand même ?"
        confirmLabel="Se déconnecter"
        onClose={() => setConfirmingSignOut(false)}
        onConfirm={() => void leave()}
      >
        <p>
          Les dernières modifications de cet appareil n’ont pas pu être envoyées au serveur : en
          vous déconnectant, elles quittent ce navigateur et seront perdues. Exportez d’abord votre
          collection depuis la page Données pour les garder.
        </p>
      </ConfirmDialog>
    </>
  )
}
