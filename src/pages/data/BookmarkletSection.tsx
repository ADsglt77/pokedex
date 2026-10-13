import { Button, Stack } from '@camply/ui'
import { BookmarkPlus, Copy } from '@camply/ui/icons'
import { useNotify } from '@/hooks/useNotify'
import { bookmarklet } from '@/lib/cardmarket'
import { DataSection } from './DataSection'
import styles from './DataPage.module.css'

/** Le favori « Ajouter au Pokédex » : l'installer, glissé dans la barre ou copié. */
export function BookmarkletSection() {
  const notify = useNotify()
  const code = bookmarklet(window.location.origin)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      notify('Code copié : collez-le comme adresse d’un nouveau favori.')
    } catch {
      notify('Le navigateur a refusé la copie : glissez plutôt le bouton.', { tone: 'warn' })
    }
  }

  return (
    <DataSection id="favori" title="Favori Cardmarket">
      <p>
        Sur la page d’une carte chez Cardmarket, ce favori ouvre l’app avec son id, son nom et
        l’adresse de sa page : il ne reste qu’à choisir son Pokémon. Il ne fait que lire la page
        ouverte ; rien n’est envoyé ailleurs qu’à l’app.
      </p>
      <ol className={styles.steps}>
        <li>Affichez la barre de favoris du navigateur (Ctrl + Maj + B).</li>
        <li>Glissez-y le bouton « Ajouter au Pokédex ».</li>
        <li>Chez Cardmarket, sur la page d’une carte, cliquez sur ce favori.</li>
      </ol>
      <Stack direction="horizontal" gap={3} wrap>
        {/* React refuse les adresses javascript: en attribut : on la pose sur le lien monté. */}
        <Button asChild leftIcon={<BookmarkPlus size={16} />}>
          <a ref={(link) => link?.setAttribute('href', code)}>Ajouter au Pokédex</a>
        </Button>
        <Button variant="ghost" leftIcon={<Copy size={16} />} onClick={copy}>
          Copier le code du favori
        </Button>
      </Stack>
      <p className="muted">
        Sans barre de favoris (téléphone, tablette) : copiez le code, créez un favori de n’importe
        quelle page, puis remplacez son adresse par le code copié.
      </p>
    </DataSection>
  )
}
