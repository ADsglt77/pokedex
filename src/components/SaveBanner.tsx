import { Alert, Banner, Button, Stack } from '@camply/ui'
import { Download, LogIn, RefreshCw, X } from '@camply/ui/icons'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportCollectionButton, SetAsideExportButtons } from '@/components/ExportCollectionButton'
import { useExportSetAside } from '@/hooks/useExportCollection'
import { loginPath } from '@/lib/account'
import { cx } from '@/lib/cx'
import { formatDateTime } from '@/lib/format'
import {
  forgetSetAside,
  hasChangesAtRisk,
  hasUnsavedChanges,
  save,
  useAccountStore,
  type SetAside,
} from '@/store/account'
import styles from './SaveBanner.module.css'

/** Où l'import des Réglages reprend une version exportée. */
const IMPORT = '/donnees#importer'

/**
 * Un bandeau de l'enregistrement : son texte, puis ses actions dessous (l'`action` du `Banner` de
 * camply les met à droite du texte, qu'elles écrasent sur un téléphone).
 */
function SaveNotice({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <Banner tone="warn">
      <Stack gap={2}>
        {children}
        <Stack direction="horizontal" gap={2} wrap>
          {actions}
        </Stack>
      </Stack>
    </Banner>
  )
}

/**
 * Ce qui risque de se perdre, au-dessus de chaque page de la coquille (`AppShell`), aussi sur un
 * téléphone, où l'alerte du navigateur en quittant la page (`beforeunload`) ne vient pas toujours :
 * hors ligne (« Réessayer maintenant »), la session fermée (« Se reconnecter »), avec l'export de
 * la collection ; puis chaque version mise de côté (`SetAsideNotice`). Rien quand tout va bien.
 */
export function SaveBanner() {
  const account = useAccountStore((state) => state.account)
  const status = useAccountStore((state) => state.status)
  const setAside = useAccountStore((state) => state.setAside)
  const navigate = useNavigate()
  if (!account || (status !== 'offline' && status !== 'expired' && !setAside.length)) return null

  return (
    <div className={cx('container', styles.banners)}>
      {status === 'offline' && (
        <SaveNotice
          actions={
            <>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<RefreshCw size={14} />}
                onClick={save}
              >
                Réessayer maintenant
              </Button>
              <ExportCollectionButton />
            </>
          }
        >
          <p>
            Hors ligne&nbsp;: vos modifications ne sont pas encore enregistrées. Elles repartiront
            au retour du serveur&nbsp;; d’ici là, ne fermez pas la page, ou exportez votre
            collection pour la garder.
          </p>
        </SaveNotice>
      )}
      {status === 'expired' && (
        <SaveNotice
          actions={
            <>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<LogIn size={14} />}
                onClick={() => navigate(loginPath(location.pathname + location.search))}
              >
                Se reconnecter
              </Button>
              <ExportCollectionButton />
            </>
          }
        >
          <p>
            Vous êtes déconnecté de ce compte (une connexion sur un autre appareil, ou la session
            expirée)&nbsp;: vos modifications ne s’enregistrent plus. Reconnectez-vous avec le
            pseudo «&nbsp;{account.name}&nbsp;» pour envoyer celles en attente.
          </p>
        </SaveNotice>
      )}
      {setAside.map((version) => (
        <SetAsideNotice key={version.id} version={version} />
      ))}
    </div>
  )
}

/**
 * Une version d'ici que celle du serveur a remplacée : « Exporter ma version » (l'import des
 * Réglages la reprend, en remplaçant celle du serveur), puis « Oublier », qui demande d'abord tant
 * qu'elle n'est pas exportée.
 */
function SetAsideNotice({ version }: { version: SetAside }) {
  const exportSetAside = useExportSetAside()
  const [confirming, setConfirming] = useState(false)
  const forget = () => forgetSetAside(version.id)

  return (
    <>
      <SaveNotice
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={14} />}
              onClick={() => exportSetAside(version)}
            >
              Exporter ma version
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<X size={14} />}
              onClick={() => (version.exported ? forget() : setConfirming(true))}
            >
              Oublier
            </Button>
          </>
        }
      >
        <p>
          Votre collection avait changé ailleurs&nbsp;: celle du serveur a remplacé la vôtre (
          {formatDateTime(version.at)}), mise de côté ici.
        </p>
        <p>
          {version.exported ? (
            <>
              Exportée&nbsp;: pour la reprendre, <Link to={IMPORT}>importez le fichier</Link>, qui
              remplacera celle du serveur.
            </>
          ) : (
            <>
              Pas encore exportée&nbsp;: elle sera perdue en quittant la page ou le compte.
              Exportez-la pour la garder&nbsp;; <Link to={IMPORT}>l’import</Link> la reprend.
            </>
          )}
        </p>
      </SaveNotice>
      <ConfirmDialog
        open={confirming}
        title="Oublier cette version ?"
        confirmLabel="Oublier"
        onClose={() => setConfirming(false)}
        onConfirm={forget}
      >
        <p>
          Elle n’a pas été exportée&nbsp;: ses modifications seront perdues, sans retour possible.
        </p>
      </ConfirmDialog>
    </>
  )
}

/**
 * Sur la connexion et l'inscription (`AuthCard`), quand un compte resté ici (sa session fermée)
 * perdrait quelque chose en en ouvrant un autre : une modification pas encore enregistrée, une
 * version mise de côté pas exportée. Avec ce pseudo, rien n'est perdu (`signIn`) ; avec un autre,
 * le premier envoi est refusé (`useOtherAccountGuard`) : l'export d'abord, ici même.
 */
export function PendingChangesNotice() {
  const account = useAccountStore((state) => state.account)
  // `hasChangesAtRisk` est relu à chaque rendu (sur ces pages, rien ne modifie la collection) : un
  // nouveau rendu quand une version mise de côté est exportée.
  useAccountStore((state) => state.setAside)
  if (!account || !hasChangesAtRisk()) return null

  return (
    <Alert
      tone="warn"
      title={`Modifications de «\u00a0${account.name}\u00a0» pas encore enregistrées`}
    >
      <Stack gap={2}>
        <p>
          Reconnectez-vous avec ce pseudo pour les garder&nbsp;: celles en attente partiront, et les
          versions mises de côté resteront. Avec un autre compte, elles seraient perdues&nbsp;:
          exportez-les d’abord.
        </p>
        {hasUnsavedChanges() && <ExportCollectionButton />}
        <SetAsideExportButtons />
      </Stack>
    </Alert>
  )
}
