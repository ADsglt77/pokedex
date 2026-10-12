import { SegmentedControl, type SegmentedControlProps } from '@camply/ui'
import { useId } from 'react'

/**
 * Un `SegmentedControl` avec un libellé et une aide, comme les autres champs : camply n'en donne
 * pas (ses classes de champ sont reprises pour l'allure).
 */
export function SegmentedField<T extends string>({
  label,
  hint,
  ...props
}: SegmentedControlProps<T> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <div className="camply-field">
      <span id={id} className="camply-field__label">
        {label}
      </span>
      <SegmentedControl aria-labelledby={id} size="sm" {...props} />
      {hint && <span className="camply-field__desc">{hint}</span>}
    </div>
  )
}
