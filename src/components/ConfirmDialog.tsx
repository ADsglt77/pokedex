import { Button, Modal, Stack } from '@camply/ui'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  confirmLabel: string
  /** `warn` : une action qui dépasse un seuil, sans rien détruire. */
  tone?: 'danger' | 'warn'
  /** Confirmer est impossible : un choix demandé dans la fenêtre n'est pas encore fait. */
  confirmDisabled?: boolean
  onConfirm: () => void
  onClose: () => void
  children: ReactNode
}

/** Demande de confirmation avant une action difficile à défaire, ou qui dépasse un seuil. */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  tone = 'danger',
  confirmDisabled,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            tone={tone}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Stack gap={3}>{children}</Stack>
    </Modal>
  )
}
