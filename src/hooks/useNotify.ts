import { useToast, type ToastTone } from '@camply/ui'
import { useCallback } from 'react'
import { currentDocument, replaceDocument, sameDocument } from '@/store/document'

interface NotifyOptions {
  tone?: ToastTone
  /** Ajoute un bouton « Annuler » (le toast reste alors 12 s) ; `false` : impossible d'annuler. */
  undo?: () => boolean
}

/** Le temps qu'un « Annuler » reste proposé. */
const UNDO_DURATION = 12_000

/**
 * Le dernier « Annuler » encore affiché : Ctrl+Z (⌘Z sur Mac) le lance aussi, sans aller jusqu'au
 * toast, rendu à la fin de la page (au clavier, il faudrait traverser toute la page en 12 s).
 */
let pendingUndo: { run: () => void; until: number } | null = null

addEventListener('keydown', (event) => {
  if (!pendingUndo || Date.now() > pendingUndo.until) return
  if (event.key.toLowerCase() !== 'z' || !(event.ctrlKey || event.metaKey)) return
  if (event.shiftKey || event.altKey || event.defaultPrevented) return
  // Dans un champ, Ctrl+Z annule la saisie ; une fenêtre ouverte a ses propres actions.
  const target = event.target instanceof HTMLElement ? event.target : null
  if (target?.closest('input, textarea, select, [contenteditable]')) return
  if (document.querySelector('[role=dialog]')) return
  event.preventDefault()
  const { run } = pendingUndo
  pendingUndo = null
  run()
})

/** Toasts de l'app, avec une action « Annuler » facultative (aussi Ctrl+Z, tant qu'il est affiché). */
export function useNotify() {
  const { toast, dismiss } = useToast()

  return useCallback(
    (message: string, { tone = 'success', undo }: NotifyOptions = {}) => {
      // Le toast se ferme après l'action : on annonce le résultat dans un nouveau.
      const runUndo = (undo: () => boolean) => {
        if (undo()) toast({ title: 'Modification annulée.', tone: 'info', duration: 3000 })
        else
          toast({
            title: 'Impossible d’annuler : vos données ont changé depuis.',
            tone: 'warn',
          })
      }
      const id = toast({
        title: message,
        tone,
        duration: undo ? UNDO_DURATION : 5_000,
        action: undo && {
          label: 'Annuler',
          onClick: () => {
            pendingUndo = null
            runUndo(undo)
          },
        },
      })
      if (undo) {
        pendingUndo = {
          until: Date.now() + UNDO_DURATION,
          run: () => {
            dismiss(id)
            runUndo(undo)
          },
        }
      }
    },
    [toast, dismiss],
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
