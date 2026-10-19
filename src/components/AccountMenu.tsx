import { Button, DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from '@camply/ui'
import { CloudAlert, CloudCheck, CloudOff, LogIn, LogOut, RefreshCw } from '@camply/ui/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { useNotify } from '@/hooks/useNotify'
import { loginPath } from '@/lib/account'
import { cx } from '@/lib/cx'
import { hasUnsavedChanges, save, signOut, useAccountStore, type SaveStatus } from '@/store/account'
import styles from './AccountMenu.module.css'

/** Où en est l'enregistrement de la collection : le bouton du compte, et sa phrase dans le menu. */
const STATUS: Record<SaveStatus, { label: string; icon: typeof CloudCheck; text: string }> = {
  saved: {
    label: 'Enregistrée',
    icon: CloudCheck,
    text: 'Votre collection est enregistrée sur le serveur, la même sur tous vos appareils.',
  },
  saving: {
    label: 'Enregistrement…',
    icon: RefreshCw,
    text: 'Envoi de votre dernière modification.',
  },
  offline: {
    label: 'Hors ligne',
    icon: CloudOff,
    text: 'Le serveur ne répond pas : votre dernière modification n’est pas encore enregistrée. Elle repartira à son retour ; ne fermez pas la page d’ici là.',
  },
  expired: {
    label: 'Reconnectez-vous',
    icon: CloudAlert,
    text: 'Vous êtes déconnecté (session expirée, ou connexion sur un autre appareil : un seul à la fois) : vos modifications ne s’enregistrent plus.',
  },
  reloaded: {
    label: 'Rechargée',
    icon: CloudAlert,
    text: 'Votre collection avait changé ailleurs (un autre onglet, un autre appareil) : elle a été rechargée, et votre dernière modification n’a pas été enregistrée.',
  },
  refused: {
    label: 'Envoi refusé',
    icon: CloudAlert,
    text: 'Le serveur refuse cette collection. Exportez-la depuis la page Données pour la garder.',
  },
}

/** La phrase d'un refus, avec sa raison (`refusal`) : « … : la carte « SV2a 165 » est abîmée. » */
const refusedText = (refusal: string | null) =>
  refusal
    ? `Le serveur refuse cette collection : ${refusal}. Exportez-la depuis la page Données pour la garder.`
    : STATUS.refused.text

/**
 * Le compte connecté (la coquille ne s'ouvre que connecté) : où en est l'enregistrement de la
 * collection, et un menu : se reconnecter (session fermée) ou renvoyer, puis se déconnecter. En
 * bas de la barre latérale, de sa largeur ; `compact` (barre du haut), son icône seule (le texte
 * reste lu).
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const account = useAccountStore((state) => state.account)
  const status = useAccountStore((state) => state.status)
  const refusal = useAccountStore((state) => state.refusal)
  const navigate = useNavigate()
  const notify = useNotify()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  // La déconnexion attend le serveur (15 s au plus) : le bouton du compte le dit pendant ce temps.
  const [leaving, setLeaving] = useState(false)
  if (!account) return null

  const { label, icon: Icon } = STATUS[status]
  const text = status === 'refused' ? refusedText(refusal) : STATUS[status].text
  const leave = async () => {
    setLeaving(true)
    const done = await signOut()
    setLeaving(false)
    if (done) {
      notify('Vous êtes déconnecté : votre collection reste sur le serveur.', { tone: 'info' })
      navigate('/connexion', { replace: true })
    } else {
      notify('Déconnexion impossible : le serveur ne répond pas.', { tone: 'danger' })
    }
  }
  const askToLeave = () => (hasUnsavedChanges() ? setConfirmingSignOut(true) : void leave())

  return (
    <>
      <DropdownMenu
        placement={compact ? 'bottom-end' : 'top-start'}
        trigger={
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Icon size={16} />}
            loading={leaving}
            className={cx(
              !compact && styles.wide,
              status !== 'saved' && status !== 'saving' && styles.alert,
            )}
          >
            <span className={cx(compact && 'visually-hidden')}>
              {leaving ? 'Déconnexion…' : label}
            </span>
          </Button>
        }
      >
        <MenuLabel uppercase={false} className={styles.name}>
          {account.name}
        </MenuLabel>
        <MenuLabel uppercase={false} className={styles.text}>
          {text}
        </MenuLabel>
        <MenuSeparator />
        {status === 'expired' ? (
          <MenuItem
            icon={<LogIn size={16} />}
            onSelect={() => navigate(loginPath(location.pathname + location.search))}
          >
            Se reconnecter
          </MenuItem>
        ) : (
          status === 'offline' && (
            <MenuItem icon={<RefreshCw size={16} />} onSelect={save}>
              Réessayer maintenant
            </MenuItem>
          )
        )}
        <MenuItem icon={<LogOut size={16} />} onSelect={askToLeave}>
          Se déconnecter
        </MenuItem>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Se déconnecter quand même ?"
        confirmLabel="Se déconnecter"
        onClose={() => setConfirmingSignOut(false)}
        onConfirm={() => void leave()}
      >
        <p>
          Votre dernière modification n’est pas encore enregistrée sur le serveur : en vous
          déconnectant, elle sera perdue. Exportez d’abord votre collection pour la garder.
        </p>
        <ExportCollectionButton>Exporter ma collection</ExportCollectionButton>
      </ConfirmDialog>
    </>
  )
}
