import { Button, DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from '@camply/ui'
import { CloudAlert, CloudCheck, CloudOff, LogIn, LogOut, RefreshCw } from '@camply/ui/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { SyncConflictDialog } from '@/components/SyncConflictDialog'
import { useNotify } from '@/hooks/useNotify'
import { loginPath } from '@/lib/auth-client'
import { cx } from '@/lib/cx'
import { details } from '@/lib/format'
import {
  hasUnsentChanges,
  setConflictQuestion,
  signOut,
  sync,
  useSyncStore,
  type SyncStatus,
} from '@/store/sync'
import styles from './AccountMenu.module.css'

/** Où en est la synchronisation : le bouton du compte, et sa phrase dans le menu. */
const STATUS: Record<SyncStatus, { label: string; icon: typeof CloudCheck; text: string }> = {
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
 * Le compte connecté (la coquille ne s'ouvre que connecté) : l'état de la synchronisation et un
 * menu, d'après le compte que suit le store (`signIn`) : une entrée selon l'état (choisir la
 * version à garder, se reconnecter, ou synchroniser), puis se déconnecter. Ouvre la question d'un
 * conflit : un seul dans la page. En bas de la barre latérale, de sa largeur ; `compact` (barre du
 * haut), son icône seule (le texte reste lu).
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const account = useSyncStore((state) => state.account)
  const status = useSyncStore((state) => state.status)
  const conflict = useSyncStore((state) => state.conflict)
  const navigate = useNavigate()
  const notify = useNotify()
  const dismissed = useSyncStore((state) => state.dismissed)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  if (!account) return null

  const { label, icon: Icon, text } = STATUS[status]
  const leave = async () => {
    if (await signOut()) {
      notify('Vous êtes déconnecté : votre collection reste sur le serveur.', { tone: 'info' })
      navigate('/vitrine', { replace: true })
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
              status !== 'synced' && status !== 'syncing' && styles.alert,
            )}
          >
            <span className={cx(compact && 'visually-hidden')}>{label}</span>
          </Button>
        }
      >
        <MenuLabel uppercase={false} className={styles.email}>
          {details(account.name, account.email)}
        </MenuLabel>
        <MenuLabel uppercase={false} className={styles.text}>
          {text}
        </MenuLabel>
        <MenuSeparator />
        {/* Pendant un conflit, la synchronisation attend le choix ; expirée, la session. */}
        {status === 'conflict' ? (
          <MenuItem icon={<CloudAlert size={16} />} onSelect={() => setConflictQuestion(true)}>
            Choisir la version à garder
          </MenuItem>
        ) : status === 'expired' ? (
          <MenuItem
            icon={<LogIn size={16} />}
            onSelect={() => navigate(loginPath(location.pathname + location.search))}
          >
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
          collection pour les garder.
        </p>
        <ExportCollectionButton>Exporter ma collection</ExportCollectionButton>
      </ConfirmDialog>
    </>
  )
}
