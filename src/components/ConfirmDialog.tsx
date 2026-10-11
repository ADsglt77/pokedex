import { Button, Modal, Stack } from '@camply/ui'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  children: ReactNode
}

/** Demande de confirmation avant une action difficile à défaire. */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
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
            tone="danger"
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
