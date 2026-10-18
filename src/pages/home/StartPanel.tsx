import { Button, Steps } from '@camply/ui'
import { Layers } from '@camply/ui/icons'
import { Link } from 'react-router'
import { Panel } from '@/components/Panel'

/** Une collection vide : les trois temps de l'app, et par où commencer. */
export function StartPanel() {
  return (
    <Panel title="Pour commencer" description="Trois temps, à votre rythme.">
      <Steps
        orientation="vertical"
        current={0}
        steps={[
          {
            label: 'Choisissez vos cartes',
            description:
              'Pour chaque Pokémon, la carte japonaise que vous voulez : extension par extension dans le catalogue, ou depuis sa fiche.',
          },
          {
            label: 'Marquez celles que vous avez',
            description: '« Je possède cette carte » débloque son Pokémon.',
          },
          {
            label: 'Préparez vos achats',
            description:
              'Les autres forment votre liste d’achats : l’assistant prépare votre prochaine commande dans votre budget.',
          },
        ]}
      />
      <div>
        <Button asChild leftIcon={<Layers size={16} />}>
          <Link to="/catalogue">Choisir dans le catalogue</Link>
        </Button>
      </div>
    </Panel>
  )
}
