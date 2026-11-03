/**
 * L'erreur d'un champ, annoncée aussi au lecteur d'écran (`role="alert"`, cachée : elle s'affiche
 * déjà sous le champ) : celle d'un champ de camply ne l'est pas, et le focus n'y mène pas toujours
 * (déjà au champ suivant, ou déjà dans le champ). Toujours rendue ; une `key` nouvelle à chaque
 * refus la remonte, pour que le même message soit relu. `EuroInput`, le pseudo (Mon compte) ; à
 * retirer quand camply annoncera l'erreur d'un champ.
 */
export function FieldAlert({ children }: { children?: string | null }) {
  return (
    <span className="visually-hidden" role="alert">
      {children}
    </span>
  )
}
