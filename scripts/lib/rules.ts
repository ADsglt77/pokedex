/**
 * Ce que les sources ne disent pas, ou disent mal : vérifié carte par carte en octobre 2026.
 * L'app n'en a pas besoin : l'index est déjà construit.
 */

/**
 * Les UR dorées de Noir et Blanc gardent l'illustration dans une fenêtre, comme une carte
 * ordinaire : ce ne sont pas des pleines cartes.
 */
export const isWindowedGold = (setId: string, code: string) => code === 'UR' && /^BW\d/.test(setId)

/**
 * Les GX, TAG TEAM GX, V, VMAX et VSTAR ont l'illustration sur toute la carte, même ordinaires : ils
 * comptent quelle que soit leur rareté, en RR (GX, V) ou RRR (VMAX, VSTAR, V-UNION) comme le code
 * imprimé. `name` : le nom anglais de TCGplayer, sans le numéro.
 */
export const fullIllustrationClass = (name: string) =>
  /\b(VMAX|VSTAR|V-UNION)\b/.test(name) ? 'RRR' : /\b(GX|V)\b/.test(name) ? 'RR' : null

/**
 * Les EX, Méga-EX, ex et Méga-ex ordinaires gardent le cadre de leur type, et l'image ne les
 * distingue pas de leur version pleine carte : seule celle-ci compte, notée par sa rareté ou, dans
 * un deck ou une promo, dans `FULL_ART_CLASSES`. Les BREAK (l'évolution dorée) ne comptent pas.
 */
export const REGULAR_FRAME = /\b(EX|Ex|ex|BREAK)\b|^(M|Mega) /

/** Les pleines cartes commencent avec Noir et Blanc : les groupes plus anciens ne sont pas jugés. */
export const FULL_ART_SINCE = '2010-09-01'

/**
 * Ce que ni la rareté ni l'image ne disent bien, vu carte par carte : id (au format de TCGdex :
 * extension, puis numéro) → classe, ou `null` pour « pas une pleine carte ». Passe avant tout le
 * reste. Les promos pleine carte sont en classe `PR` (« pleine carte hors rareté »).
 * Comptent : l'illustration couvre toute la carte, sans fenêtre ni cadre de carte ordinaire ; les GX
 * et V ordinaires comptent (`fullIllustrationClass`), pas les EX ni les ex ordinaires.
 * Pour corriger une carte : son id ici, puis `bun run data:cards`. Une carte que le script liste
 * « à revoir » s'y note aussi, pleine ou non, pour qu'il ne la liste plus.
 */
export const FULL_ART_CLASSES: Readonly<Record<string, string | null>> = {
  // Raretés mal saisies chez TCGplayer
  'CP6-094': 'SR', // Pikachu-EX, « Double Rare » chez TCGplayer, SR imprimé
  'SV4a-358': 'UR', // Miraidon-ex dorée, sans rareté chez TCGplayer
  'SV4a-359': 'UR', // Ting-Lu-ex dorée, sans rareté chez TCGplayer
  // Decks et coffrets : leurs EX et ex pleine carte n'ont pas de rareté qui le dise
  'EBB-094': 'UR', // Reshiram doré, EX Battle Boost
  'EBB-095': 'UR', // Zekrom argenté
  'XYB-019': 'UR', // Dialga-EX argenté, Hyper Metal Chain Deck
  'XYC-006': 'SR', // Yveltal-EX, Super Legend Set
  'XYC-012': 'SR', // Xerneas-EX
  'XY-172': 'SR', // The Best of XY : ses EX pleine carte, numérotés au-delà de 171
  'XY-173': 'SR',
  'XY-174': 'SR',
  'XY-175': 'SR',
  'XY-176': 'SR',
  'XY-177': 'SR',
  'XY-178': 'SR',
  'XY-179': 'SR',
  'XY-187': 'SR',
  'XY-188': 'SR',
  'WCS23-001': 'PR', // Pikachu-ex, deck des Championnats du monde 2023
  'MC-757': 'PR', // Start Deck 100 Battle Collection : ses ex pleine carte
  'MC-758': 'PR',
  'MC-759': 'PR',
  'MC-761': 'PR',
  'MC-762': 'PR',
  'MC-763': 'PR',
  'MC-764': 'PR',
  'MC-765': 'PR',
  'MC-766': 'UR', // Méga-Dracaufeu Y-ex doré
  'MF-043': 'PR', // Mentali-ex, 30th CELEBRATION Premium Deck Set
  'MF-044': 'PR', // Noctali-ex
  // Traits antiques (XY5 à XY7) : pleines cartes que l'image ne reconnaît pas toujours
  'XY5a-023': 'PR', // Dynavolt
  'XY5a-028': 'PR', // Nidoqueen
  'XY5b-030': 'PR', // Rosabyss
  'XY5b-041': 'PR', // Tentacool
  'XY6-008': 'PR', // Papinox
  'XY6-024': 'PR', // Natu
  'XY6-060': 'PR', // Altaria
  'XY6-067': 'PR', // Déflaisan
  'XY7-050': 'PR', // Métalosse
  'XY7-067': 'PR', // Porygon-Z
  'XY-P-162': 'PR', // Altaria
  // Pas des pleines cartes, malgré l'image ou un numéro secret
  '20th-073': null, // Tortank-EX ordinaire, BREAK Starter Pack
  '20th-074': null, // Méga-Tortank-EX ordinaire
  'CP5-037': null, // Yveltal-EX ordinaire, Dream Shine Collection
  'CP5-038': null, // Xerneas-EX ordinaire
  'CP4-007': null, // Méga-Jungko-EX ordinaire (sans « EX » chez TCGplayer)
  'CP4-043': null, // Méga-Élecsprint-EX ordinaire
  'CP4-051': null, // Méga-Mewtwo-EX ordinaire
  'CP4-075': null, // Méga-Lucario-EX ordinaire
  'XY11a-033': null, // Méga-Steelix-EX ordinaire
  'XY-P-272': null, // Méga-Rayquaza-EX ordinaire
  'XY-P-298': null, // M Sachiko EX, Méga-EX ordinaire
  's8a-P-017': null, // Luxray GL NIV.X, réédition au cadre d'origine
  's8a-P-018': null, // Carchacrok C NIV.X
  's8a-G-004': null, // Raichu, illustration en fenêtre
  'sN-002': null, // Emolga, illustration en fenêtre
  // Promos de Noir et Blanc
  'BW-P-112': 'PR', // Démétéros
  'BW-P-145': 'PR', // Rayquaza-EX
  'BW-P-146': 'PR', // Giratina-EX
  'BW-P-158': 'PR', // Reshiram-EX
  'BW-P-159': 'PR', // Zekrom-EX
  'BW-P-229': 'PR', // Pikachu
  // XY
  'XY-P-090': 'PR', // Pikachu, Battle Festa 2014
  'XY-P-150': 'PR', // Pikachu déguisé en Magicarpe
  'XY-P-151': 'PR', // Pikachu déguisé en Léviator
  'XY-P-155': 'PR', // Hoopa
  'XY-P-175': 'PR', // Pikachu, Battle Festa 2015
  'XY-P-207': 'PR', // Pikachu en poncho Méga-Dracaufeu X
  'XY-P-208': 'PR', // Pikachu en poncho Méga-Dracaufeu Y
  'XY-P-230': 'PR', // Pikachu en poncho Rayquaza
  'XY-P-231': 'PR', // Pikachu en poncho Rayquaza chromatique
  'XY-P-268': 'PR', // Magearna
  'XY-P-276': 'PR', // Dracaufeu-EX
  'XY-P-279': 'PR', // Pikachu, 20e anniversaire
  'XY-P-294': 'PR', // Mario Pikachu
  'XY-P-296': 'PR', // Luigi Pikachu
  // Soleil et Lune
  'SM-P-013': 'PR', // Pikachu déguisé en Team Skull
  'SM-P-061': 'PR', // Pikachu, Poké Card Festa 2017
  'SM-P-068': 'PR', // Pikachu, Champions League 2017
  'SM-P-239': 'PR', // Zekrom-GX
  'SM-P-240': 'PR', // Zekrom-GX arc-en-ciel
  'SM-P-270': 'PR', // Pikachu de Red
  'SM-P-286': 'PR', // Psykokwak, « Le Cri » de Munch
  'SM-P-287': 'PR', // Évoli, « Le Cri »
  'SM-P-288': 'PR', // Pikachu, « Le Cri »
  'SM-P-289': 'PR', // Mimiqui, « Le Cri »
  'SM-P-290': 'PR', // Brindibou, « Le Cri »
  'SM-P-363': 'PR', // Mewtwo-GX
  'SM-P-364': 'PR', // Mewtwo-GX arc-en-ciel
  'SM-P-365': 'PR', // Mewtwo armuré
  'SM-P-381': 'PR', // Mélofée de Lilie
  'SM-P-400': 'PR', // Pikachu
  // Épée et Bouclier
  'S-P-001': 'PR', // Pikachu
  'S-P-103': 'PR', // Dracaufeu V
  'S-P-104': 'PR', // Dracaufeu VMAX arc-en-ciel
  'S-P-152': 'PR', // Nostenfer V chromatique
  'S-P-186': 'PR', // Pyroli VMAX
  'S-P-187': 'PR', // Aquali VMAX
  'S-P-188': 'PR', // Voltali VMAX
  'S-P-189': 'PR', // Mentali VMAX
  'S-P-226': 'PR', // Nigosier, Mitsuhiro Arita
  'S-P-227': 'PR', // Pikachu en kimono, Mitsuhiro Arita
  'S-P-305': 'PR', // Lucario VSTAR arc-en-ciel
  'S-P-323': 'PR', // Pikachu
  's8a-P-020': 'PR', // Reshiram, 25e anniversaire
  's8a-P-021': 'PR', // Zekrom, 25e anniversaire
  // Écarlate et Violet
  'SV-P-001': 'PR', // Pikachu
  'SV-P-048': 'PR', // Miraidon
  'SV-P-049': 'PR', // Koraidon
  'SV-P-098': 'PR', // Détective Pikachu
  'SV-P-148': 'PR', // Ogerpon
  'SV-P-192': 'PR', // Miaouss
  'SV-P-193': 'PR', // Axoloto de Paldea
  'SV-P-218': 'PR', // Pikachu
  'SV-P-232': 'PR', // Zapétrel de Mashynn
  'SV-P-241': null, // Aligatueur, Illustration Contest 2024 : illustration en fenêtre
  'SV-P-271': 'PR', // Victini
  'SV-P-288': 'PR', // Victini rouge
}

/**
 * Images que TCGdex range à l'adresse habituelle d'une autre carte (une extension entière ou une
 * carte) : on prend celle de TCGplayer. Trouvées en comparant à l'œil les images devinées à
 * celles de TCGplayer.
 */
export const WRONG_TCGDEX_IMAGES: ReadonlySet<string> = new Set([
  'M1S', // décalée : chaque adresse montre une autre carte de l'extension
  'M4-103', // l'illustration d'une autre carte de Pashmilla-ex
])

/**
 * Extensions que les sources décrivent mal : `group` est le nom du groupe TCGplayer quand
 * l'abréviation ne suffit pas à le trouver (« BW1 » en désigne deux), `name` le nom japonais quand
 * TCGdex n'a pas l'extension du tout ou se trompe. Les ids suivent la façon de TCGdex : `a` puis `b`
 * pour les extensions jumelles.
 */
export const TCGPLAYER_SETS: Readonly<Record<string, { group?: string; name?: string }>> = {
  // TCGdex lui donne le nom de SV3a (レイジングサーフ).
  SV4a: { name: 'シャイニートレジャーex' },
  MC: { group: 'Start Deck 100 Battle Collection' },
  SVLS: { group: 'SV: Ceruledge ex Stellar Tera Type Starter Set' },
  XY1a: { group: 'XY-Bx: Collection X' },
  XY1b: { group: 'XY-By: Collection Y' },
  XY5a: { group: 'XY5-Bg: Gaia Volcano' },
  XY5b: { group: 'XY5-Bt: Tidal Storm' },
  XY8a: { group: 'XY8-Bb: Blue Shock' },
  XY8b: { group: 'XY8-Br: Red Flash' },
  XY11a: { group: 'XY11-Bb: Fever-Burst Fighter' },
  XY11b: { group: 'XY11-Br: Cruel Traitor' },
  BW1a: { group: 'BW1: Black Collection', name: 'ブラックコレクション' },
  BW1b: { group: 'BW1: White Collection', name: 'ホワイトコレクション' },
  BW2: { group: 'BW2: Red Collection', name: 'レッドコレクション' },
  BW3a: { group: 'BW3: Psycho Drive', name: 'サイコドライブ' },
  BW3b: { group: 'BW3: Hail Blizzard', name: 'ヘイルブリザード' },
  BW4: { group: 'BW4: Dark Rush', name: 'ダークラッシュ' },
  BW5a: { group: 'BW5: Dragon Blade', name: 'リューノブレード' },
  BW5b: { group: 'BW5: Dragon Blast', name: 'リューノブラスト' },
  BW6a: { group: 'BW6: Freeze Bolt', name: 'フリーズボルト' },
  BW6b: { group: 'BW6: Cold Flare', name: 'コールドフレア' },
  BW7: { group: 'BW7: Plasma Gale', name: 'プラズマゲイル' },
  BW8a: { group: 'BW8: Spiral Force', name: 'スパイラルフォース' },
  BW8b: { group: 'BW8: Thunder Knuckle', name: 'ライデンナックル' },
  BW9: { group: 'BW9: Megalo Cannon', name: 'メガロキャノン' },
  SC: { group: 'Shiny Collection', name: 'シャイニーコレクション' },
  MBD: { group: 'MBD: MEGA Starter Set Mega Diancie ex', name: 'MEGA Starter Set Mega Diancie ex' },
  MBG: { group: 'MBG: MEGA Starter Set Mega Gengar ex', name: 'MEGA Starter Set Mega Gengar ex' },
  'BW-P': { group: 'BW-P Promotional cards', name: 'BW プロモカード' },
  'XY-P': { group: 'XY-P: XY Promos', name: 'XY プロモカード' },
  'SM-P': { group: 'SM-P: Sun & Moon Promos', name: 'サン&ムーン プロモカード' },
  'S-P': { group: 'S-P: Sword & Shield Promos', name: 'ソード&シールド プロモカード' },
  's8a-P': {
    group: 's8a-P: Promo Card Pack 25th Anniversary Edition',
    name: 'プロモカードパック 25th ANNIVERSARY edition',
  },
}

/** Cartes rangées sous la mauvaise espèce (par TCGdex, ou d'après leur nom), vérifiées sur la carte. */
export const DEX_ID_CORRECTIONS: Readonly<Record<string, number[]>> = {
  'S6K-072': [883], // Hydragla V (ウオチルドンV)
  // Pikachu déguisés : le nom anglais nomme aussi le Pokémon du déguisement.
  'XY-P-150': [25],
  'XY-P-151': [25],
}
