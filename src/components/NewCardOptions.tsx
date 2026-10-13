import { Checkbox, Stack } from '@camply/ui'
import type { NewCardChoices } from '@/store/shopping'

/** Les deux cases de l'ajout : « Je la possède déjà », « À acheter ». */
export function NewCardOptions({
  choices,
  onChange,
}: {
  choices: NewCardChoices
  onChange: (choices: NewCardChoices) => void
}) {
  return (
    <Stack direction="horizontal" gap={4} wrap>
      <Checkbox
        label="Je la possède déjà"
        checked={choices.owned}
        onChange={(event) => onChange({ ...choices, owned: event.target.checked })}
      />
      <Checkbox
        label="À acheter (liste d’achats)"
        checked={choices.toBuy}
        onChange={(event) => onChange({ ...choices, toBuy: event.target.checked })}
      />
    </Stack>
  )
}
