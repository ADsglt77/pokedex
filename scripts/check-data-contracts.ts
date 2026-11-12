import type * as App from '../src/types'
import type * as Data from '../../pokedex-data/src/contract'

/** Vrai seulement si les deux types sont exactement interchangeables. */
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false

type Assert<Condition extends true> = Condition

/**
 * Contrat inter-dépôts : `tsc` échoue dès qu'un type partagé diverge entre le site et l'API (les
 * deux copies de travail : pas ce qui est en ligne ; pendant un déploiement, la règle « élargir
 * puis restreindre » de `docs/deploiement.md`). Les types purement internes à l'un des deux projets
 * ne figurent volontairement pas ici. Lancé par `bun lint` ici, et par `bun run lint` des données
 * quand ce dépôt est à côté.
 */
export type DataContractsMatch = [
  Assert<Equal<App.PokemonTypeId, Data.PokemonTypeId>>,
  Assert<Equal<App.GenerationId, Data.GenerationId>>,
  Assert<Equal<App.TotalSpecies, Data.TotalSpecies>>,
  Assert<Equal<App.PokemonSpecies, Data.PokemonSpecies>>,
  Assert<Equal<App.PokemonSpeciesDetails, Data.PokemonSpeciesDetails>>,
  Assert<Equal<App.CardLanguage, Data.CardLanguage>>,
  Assert<Equal<App.SpeciesFile, Data.SpeciesFile>>,
  Assert<Equal<App.SpeciesDetailsFile, Data.SpeciesDetailsFile>>,
  Assert<Equal<App.CatalogFile, Data.CatalogFile>>,
  Assert<Equal<App.CatalogSetsFile, Data.CatalogSetsFile>>,
  Assert<Equal<App.CatalogSetFile, Data.CatalogSetFile>>,
  Assert<Equal<App.ImageSize, Data.ImageSize>>,
  Assert<Equal<App.CardScanPath, Data.CardScanPath>>,
  Assert<Equal<App.SetLogoPath, Data.SetLogoPath>>,
  Assert<Equal<App.TypeIconPath, Data.TypeIconPath>>,
  Assert<Equal<App.RarityIconPath, Data.RarityIconPath>>,
  Assert<Equal<App.SpritePath, Data.SpritePath>>,
  Assert<Equal<App.ArtworkPath, Data.ArtworkPath>>,
  Assert<Equal<App.JobState, Data.JobState>>,
  Assert<Equal<App.ServerStatus, Data.ServerStatus>>,
  Assert<Equal<App.PriceFile, Data.PriceFile>>,
  Assert<Equal<App.WantsLines, Data.WantsLines>>,
  Assert<Equal<App.CardPriceHistory, Data.CardPriceHistory>>,
  Assert<Equal<App.PriceHistories, Data.PriceHistories>>,
]
