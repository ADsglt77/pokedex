/**
 * La forme des réponses de l'API (`src/types.ts`, « Réponses de l'API »). À augmenter avec elle :
 * le service worker range alors ses copies dans un nouveau cache (`donnees-<n>`, l'ancien oublié :
 * jamais une copie d'une ancienne forme lue par le nouveau code, sur un réseau faible), et l'ETag
 * des réponses calculées à la demande change (`server/snapshots.ts`). 2 : les prix rendent une clé
 * par carte demandée, `null` sans prix (octobre 2026).
 */
export const API_FORMAT = 2
