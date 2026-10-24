import { Button, DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from '@camply/ui'
import { CloudAlert, CloudCheck, CloudOff, LogIn, LogOut, RefreshCw } from '@camply/ui/icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { useNotify } from '@/hooks/useNotify'
import { loginPath } from '@/lib/account'
import { cx } from '@/lib/cx'
import { formatDecimal } from '@/lib/format'
import { hasUnsavedChanges, save, signOut, useAccountStore, type SaveStatus } from '@/store/account'
import { MAX_DOCUMENT } from '@/types'
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
    text: 'Vous êtes déconnecté : session expirée, connexion sur un autre appareil (un seul à la fois) ou à un autre compte dans un autre onglet. Vos modifications ne s’enregistrent plus ; reconnectez-vous à ce compte, et celles en attente partiront.',
  },
  reloaded: {
    label: 'Rechargée',
    icon: CloudAlert,
    text: 'Votre collection avait changé ailleurs (un autre onglet, un autre appareil) : elle a été rechargée, et votre dernière modification n’a pas été enregistrée.',
  },
  refused: {
    label: 'Envoi refusé',
    icon: CloudAlert,
    text: 'Le serveur refuse cette collection. Exportez-la depuis les Réglages pour la garder.',
  },
}

/** Un refus, avec sa raison : « … : la carte « SV2a 165 » est abîmée. » */
const refusalText = (refusal: string) =>
  `Le serveur refuse cette collection : ${refusal}. Exportez-la depuis les Réglages pour la garder.`

/** À 80 % du plus gros document que garde le serveur, l'app avertit. */
const HEAVY = MAX_DOCUMENT * 0.8

/** « Votre collection pèse 4,2 Mo sur les 5 Mo que garde le serveur : … » */
const heavyText = (weight: number) =>
  `Votre collection pèse ${formatDecimal(weight / 1_000_000)}\u00a0Mo sur les ${formatDecimal(MAX_DOCUMENT / 1_000_000)}\u00a0Mo que garde le serveur\u00a0: au-delà, plus rien ne s’enregistrerait.`

/** L'avertissement des 80 % n'est donné en toast qu'une fois par page (`StrictMode` compris). */
let heavyWarned = false

/**
 * Le compte connecté (la coquille ne s'ouvre que connecté) : où en est l'enregistrement de la
 * collection, et un menu : se reconnecter (session fermée) ou renvoyer, puis se déconnecter. En
 * bas de la barre latérale, de sa largeur ; `compact` (barre du haut), son icône seule (le texte
 * reste lu). Ce qui s'y voit mal sur un téléphone (rien que l'icône) a aussi son toast : une
 * collection rechargée ou refusée, et une collection qui approche du plafond du serveur (80 %).
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const account = useAccountStore((state) => state.account)
  const status = useAccountStore((state) => state.status)
  const refusal = useAccountStore((state) => state.refusal)
  const weight = useAccountStore((state) => state.weight)
  const navigate = useNavigate()
  const notify = useNotify()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [confirmingLogin, setConfirmingLogin] = useState(false)
  // La déconnexion attend le serveur (15 s au plus) : le bouton du compte le dit pendant ce temps.
  const [leaving, setLeaving] = useState(false)

  // « Rechargée » et « Envoi refusé » : au passage seulement, pas à l'affichage du menu. Les 80 % :
  // une fois par page, à l'affichage (la collection déjà lourde à l'ouverture) ou au passage.
  useEffect(() => {
    const warnHeavy = (weight: number) => {
      if (weight <= HEAVY || heavyWarned) return
      heavyWarned = true
      notify(heavyText(weight), { tone: 'warn' })
    }
    warnHeavy(useAccountStore.getState().weight)
    return useAccountStore.subscribe((state, previous) => {
      if (state.status !== previous.status && state.status === 'reloaded') {
        notify('Vos dernières modifications ont été remplacées par celles d’un autre appareil.', {
          tone: 'warn',
        })
      }
      if (state.status !== previous.status && state.status === 'refused' && state.refusal) {
        notify(refusalText(state.refusal), { tone: 'danger' })
      }
      warnHeavy(state.weight)
    })
  }, [notify])
  if (!account) return null

  const { label, icon: Icon } = STATUS[status]
  const text = status === 'refused' && refusal ? refusalText(refusal) : STATUS[status].text
  const login = () => navigate(loginPath(location.pathname + location.search))
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
        {weight > HEAVY && (
          <MenuLabel uppercase={false} className={styles.text}>
            {heavyText(weight)}
          </MenuLabel>
        )}
        <MenuSeparator />
        {status === 'expired' ? (
          <MenuItem
            icon={<LogIn size={16} />}
            onSelect={() => (hasUnsavedChanges() ? setConfirmingLogin(true) : login())}
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
        <ExportCollectionButton />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmingLogin}
        title="Se reconnecter ?"
        confirmLabel="Se reconnecter"
        tone="warn"
        onClose={() => setConfirmingLogin(false)}
        onConfirm={login}
      >
        <p>
          Votre dernière modification n’est pas encore enregistrée sur le serveur&nbsp;: elle
          partira si vous vous reconnectez avec le pseudo «&nbsp;{account.name}&nbsp;». Avec un
          autre compte, elle serait perdue&nbsp;: exportez d’abord votre collection pour la garder.
        </p>
        <ExportCollectionButton />
      </ConfirmDialog>
    </>
  )
}
