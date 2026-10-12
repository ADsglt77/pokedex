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
 * Promos en illustration pleine carte (classe `PR` ; « PROMO » se confondrait avec le libellé
 * « Promo » des promos). Rien ne les distingue des autres promos (TCGplayer les note « Common ») :
 * choisies à la vue parmi les promos Pokémon BW-P, XY-P, SM-P, S-P, s8a-P et SV-P de TCGplayer.
 * Comptent : l'illustration couvre toute la carte, sans fenêtre ni cadre de carte ordinaire (une
 * EX, GX, V ou ex ordinaire ne compte pas, sa version pleine carte oui). Id au format de TCGdex :
 * extension, puis numéro. Pour en ajouter une : son id ici, puis `bun run data:cards`.
 */
export const FULL_ART_PROMO_IDS: ReadonlySet<string> = new Set([
  // Noir et Blanc
  'BW-P-112', // Démétéros
  'BW-P-145', // Rayquaza-EX
  'BW-P-146', // Giratina-EX
  'BW-P-158', // Reshiram-EX
  'BW-P-159', // Zekrom-EX
  'BW-P-229', // Pikachu
  // XY
  'XY-P-090', // Pikachu, Battle Festa 2014
  'XY-P-150', // Pikachu déguisé en Magicarpe
  'XY-P-151', // Pikachu déguisé en Léviator
  'XY-P-155', // Hoopa
  'XY-P-175', // Pikachu, Battle Festa 2015
  'XY-P-207', // Pikachu en poncho Méga-Dracaufeu X
  'XY-P-208', // Pikachu en poncho Méga-Dracaufeu Y
  'XY-P-230', // Pikachu en poncho Rayquaza
  'XY-P-231', // Pikachu en poncho Rayquaza chromatique
  'XY-P-268', // Magearna
  'XY-P-276', // Dracaufeu-EX
  'XY-P-279', // Pikachu, 20e anniversaire
  'XY-P-294', // Mario Pikachu
  'XY-P-296', // Luigi Pikachu
  // Soleil et Lune
  'SM-P-013', // Pikachu déguisé en Team Skull
  'SM-P-061', // Pikachu, Poké Card Festa 2017
  'SM-P-068', // Pikachu, Champions League 2017
  'SM-P-239', // Zekrom-GX
  'SM-P-240', // Zekrom-GX arc-en-ciel
  'SM-P-270', // Pikachu de Red
  'SM-P-286', // Psykokwak, « Le Cri » de Munch
  'SM-P-287', // Évoli, « Le Cri »
  'SM-P-288', // Pikachu, « Le Cri »
  'SM-P-289', // Mimiqui, « Le Cri »
  'SM-P-290', // Brindibou, « Le Cri »
  'SM-P-363', // Mewtwo-GX
  'SM-P-364', // Mewtwo-GX arc-en-ciel
  'SM-P-365', // Mewtwo armuré
  'SM-P-381', // Mélofée de Lilie
  'SM-P-400', // Pikachu
  // Épée et Bouclier
  'S-P-001', // Pikachu
  'S-P-103', // Dracaufeu V
  'S-P-104', // Dracaufeu VMAX arc-en-ciel
  'S-P-152', // Nostenfer V chromatique
  'S-P-186', // Pyroli VMAX
  'S-P-187', // Aquali VMAX
  'S-P-188', // Voltali VMAX
  'S-P-189', // Mentali VMAX
  'S-P-226', // Nigosier, Mitsuhiro Arita
  'S-P-227', // Pikachu en kimono, Mitsuhiro Arita
  'S-P-305', // Lucario VSTAR arc-en-ciel
  'S-P-323', // Pikachu
  's8a-P-020', // Reshiram, 25e anniversaire
  's8a-P-021', // Zekrom, 25e anniversaire
  // Écarlate et Violet
  'SV-P-001', // Pikachu
  'SV-P-048', // Miraidon
  'SV-P-049', // Koraidon
  'SV-P-098', // Détective Pikachu
  'SV-P-148', // Ogerpon
  'SV-P-192', // Miaouss
  'SV-P-193', // Axoloto de Paldea
  'SV-P-218', // Pikachu
  'SV-P-232', // Zapétrel de Mashynn
  'SV-P-241', // Aligatueur, Illustration Contest 2024
  'SV-P-271', // Victini
  'SV-P-288', // Victini rouge
])

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
 * Extensions dont l'abréviation TCGplayer ne suffit pas à trouver le groupe : `group` est le nom du
 * groupe (« BW1 » en désigne deux), `name` le nom japonais quand TCGdex n'a pas l'extension du
 * tout. Les ids suivent la façon de TCGdex : `a` puis `b` pour les extensions jumelles.
 */
export const TCGPLAYER_SETS: Readonly<Record<string, { group: string; name?: string }>> = {
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
