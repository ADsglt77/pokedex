import { Button, Stack, Switch } from '@camply/ui'
import { DEFAULT_ENABLED_RARITY_CODES, RARITY_CLASSES } from '@/config/rarities'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import { unlockedOf } from '@/lib/format'
import { defaultSettings, useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import styles from './DataPage.module.css'

const GROUPS = [
  { tier: 'illustration', title: 'Illustrations' },
  { tier: 'fullArt', title: 'Autres pleines cartes' },
] as const

/** Quelles classes de pleines cartes sont suivies, avec l'effet immédiat sur la progression. */
export function ClassificationSection() {
  const act = useCollectionAction()
  const settings = useCollectionStore((state) => state.settings)
  const { progress } = usePokedex()
  const isDefault = settings.enabledRarityCodes.join() === DEFAULT_ENABLED_RARITY_CODES.join()

  const resetToDefaults = () =>
    act(
      () => useCollectionStore.getState().replaceSettings(defaultSettings()),
      'Raretés suivies par défaut rétablies.',
    )

  return (
    <DataSection id="classification" title="Raretés suivies">
      <p>Les cartes de ces raretés sont proposées comme illustrations candidates.</p>

      {GROUPS.map(({ tier, title }) => (
        <Stack key={tier} gap={4} className={styles.group}>
          <h3 className={styles.groupTitle}>{title}</h3>
          {RARITY_CLASSES.filter((rarityClass) => rarityClass.tier === tier).map((rarityClass) => (
            <Switch
              key={rarityClass.code}
              label={`${rarityClass.code} · ${rarityClass.label}`}
              hint={rarityClass.description}
              checked={settings.enabledRarityCodes.includes(rarityClass.code)}
              onChange={(event) =>
                useCollectionStore
                  .getState()
                  .setRarityEnabled(rarityClass.code, event.target.checked)
              }
              spread
            />
          ))}
        </Stack>
      ))}

      <p aria-live="polite">Avec ces réglages : {unlockedOf(progress, 'Pokémon')}.</p>
      <Button variant="secondary" disabled={isDefault} onClick={resetToDefaults}>
        Rétablir les réglages par défaut
      </Button>
    </DataSection>
  )
}
