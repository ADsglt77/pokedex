import { Input, type InputProps } from '@camply/ui'
import { useState } from 'react'
import { euroInput, parseEuros } from '@/lib/format'

/** Ce qu'a tout champ de montant en euros. */
const EURO_FIELD = {
  inputMode: 'decimal',
  placeholder: '0,00',
  rightIcon: <span aria-hidden="true">€</span>,
} as const

interface CommitInputProps<T> extends Omit<
  InputProps,
  'value' | 'onChange' | 'onBlur' | 'onKeyDown' | 'error'
> {
  value: T | undefined
  /** Le texte saisi → la valeur ; `null` s'il est illisible. Un champ vide vaut `undefined`. */
  parse: (text: string) => T | null
  format: (value: T) => string
  /** Le message affiché quand `parse` échoue. */
  invalid?: string
  onCommit: (value: T | undefined) => void
}

/**
 * Un champ enregistré en le quittant (ou par Entrée), pas à chaque frappe. Il repart de la valeur
 * enregistrée quand elle change ailleurs : annulation, autre onglet.
 */
export function CommitInput<T>({
  value,
  parse,
  format,
  invalid,
  onCommit,
  ...inputProps
}: CommitInputProps<T>) {
  const saved = value === undefined ? '' : format(value)
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
    const next = text === '' ? undefined : parse(text)
    if (next === null) return setError(invalid)
    setError(undefined)
    if (next !== value) onCommit(next)
  }

  return (
    <Input
      autoComplete="off"
      {...inputProps}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && commit()}
      error={error}
    />
  )
}

/** Un champ de montant en euros, contrôlé par son parent (formulaire). */
export const EuroField = (props: InputProps) => <Input {...EURO_FIELD} {...props} />

/** Un montant en euros (« 12,50 »), enregistré en quittant le champ. */
export function EuroInput(props: Omit<CommitInputProps<number>, 'parse' | 'format' | 'invalid'>) {
  return (
    <CommitInput
      {...EURO_FIELD}
      {...props}
      parse={parseEuros}
      format={euroInput}
      invalid="Indiquez un montant en euros, par exemple 12,50."
    />
  )
}
