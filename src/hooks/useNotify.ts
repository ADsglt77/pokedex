import { useToast, type ToastTone } from '@camply/ui'
import { useCallback } from 'react'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'

interface NotifyOptions {
  tone?: ToastTone
  /** Ajoute un bouton « Annuler » (le toast reste alors 12 s) ; `false` : impossible d'annuler. */
  undo?: () => boolean
}

/** Toasts de l'app, avec une action « Annuler » facultative. */
export function useNotify() {
  const { toast } = useToast()

  return useCallback(
    (message: string, { tone = 'success', undo }: NotifyOptions = {}) => {
      toast({
        title: message,
        tone,
        duration: undo ? 12_000 : 5_000,
        action: undo && {
          label: 'Annuler',
          // Le toast se ferme après l'action : on annonce le résultat dans un nouveau.
          onClick: () => {
            if (undo()) toast({ title: 'Modification annulée.', tone: 'info', duration: 3000 })
            else
              toast({
                title: 'Impossible d’annuler : vos données ont changé depuis.',
                tone: 'warn',
              })
          },
        },
      })
    },
    [toast],
  )
}

/** Tout ce qu'une action peut modifier : collection, réglages, achats. */
const snapshot = () => {
  const { collection, settings } = useCollectionStore.getState()
  return { collection, settings, shopping: useShoppingStore.getState().shopping }
}

type Snapshot = ReturnType<typeof snapshot>

const sameSnapshot = (a: Snapshot, b: Snapshot) =>
  a.collection === b.collection && a.settings === b.settings && a.shopping === b.shopping

/**
 * Lance une modification de la collection, des réglages ou des achats, puis l'annonce avec
 * « Annuler ». Annuler rétablit l'état d'avant, seulement si rien n'a changé depuis : une
 * modification faite entre-temps n'est jamais effacée. Rien n'est annoncé quand rien ne change.
 */
export function useCollectionAction() {
  const notify = useNotify()

  return useCallback(
    (change: () => void, message: string, tone: ToastTone = 'success') => {
      const before = snapshot()
      change()
      const after = snapshot()
      if (sameSnapshot(before, after)) return

      notify(message, {
        tone,
        undo: () => {
          if (!sameSnapshot(snapshot(), after)) return false
          const { shopping, ...collection } = before
          useCollectionStore.setState(collection)
          useShoppingStore.setState({ shopping })
          return true
        },
      })
    },
    [notify],
  )
}
