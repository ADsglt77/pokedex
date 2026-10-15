import { useToast, type ToastTone } from '@camply/ui'
import { useCallback } from 'react'
import { currentDocument, replaceDocument, sameDocument } from '@/store/document'

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

/**
 * Lance une modification de la collection ou des achats, puis l'annonce avec
 * « Annuler ». Annuler rétablit l'état d'avant, seulement si rien n'a changé depuis : une
 * modification faite entre-temps n'est jamais effacée. Rien n'est annoncé quand rien ne change.
 */
export function useCollectionAction() {
  const notify = useNotify()

  return useCallback(
    (change: () => void, message: string, tone: ToastTone = 'success') => {
      // Tout ce qu'une action peut modifier : collection, achats.
      const before = currentDocument()
      change()
      const after = currentDocument()
      if (sameDocument(before, after)) return

      notify(message, {
        tone,
        undo: () => {
          if (!sameDocument(currentDocument(), after)) return false
          replaceDocument(before)
          return true
        },
      })
    },
    [notify],
  )
}
