import { Input, type InputProps } from '@camply/ui'
import { useState } from 'react'
import { euroInput, parseEuros } from '@/lib/format'

/** Ce qu'a tout champ de montant en euros. */
const EURO_FIELD = {
  inputMode: 'decimal',
  placeholder: '0,00',
  rightIcon: <span aria-hidden="true">€</span>,
} as const

/**
 * Un montant en euros (« 12,50 »), enregistré en quittant le champ (ou par Entrée, ou Échap), pas
 * à chaque frappe ; vide, il vaut `undefined`. Il repart du montant enregistré quand il change
 * ailleurs : annulation, autre onglet.
 */
export function EuroInput({
  value,
  onCommit,
  ...inputProps
}: Omit<InputProps, 'value' | 'onChange' | 'onBlur' | 'onKeyDown' | 'error'> & {
  value: number | undefined
  onCommit: (value: number | undefined) => void
}) {
  const saved = value === undefined ? '' : euroInput(value)
  const [draft, setDraft] = useState(saved)
  const [seen, setSeen] = useState(saved)
  const [error, setError] = useState<string>()
  if (saved !== seen) {
    setSeen(saved)
    setDraft(saved)
    setError(undefined)
  }

  const commit = () => {
    const text = draft.trim()
    const next = text === '' ? undefined : parseEuros(text)
    if (next === null) return setError('Indiquez un montant en euros, par exemple 12,50.')
    setError(undefined)
    if (next !== value) onCommit(next)
  }

  return (
    <Input
      autoComplete="off"
      {...EURO_FIELD}
      {...inputProps}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      // Échap ferme aussi la modale autour : sans enregistrer d'abord, la saisie serait perdue.
      onKeyDown={(event) => (event.key === 'Enter' || event.key === 'Escape') && commit()}
      error={error}
    />
  )
}

/** Un champ de montant en euros, contrôlé par son parent (formulaire). */
export const EuroField = (props: InputProps) => <Input {...EURO_FIELD} {...props} />
