/**
 * La forme des réponses de l'API (`src/types.ts`, copie du contrat de l'API des données), la même
 * que l'`API_FORMAT` de l'API des données. À augmenter avec elle : le service worker range alors
 * ses copies dans un nouveau cache (`donnees-<n>`, l'ancien oublié : jamais une copie d'une
 * ancienne forme lue par le nouveau code, sur un réseau faible), et l'ETag des réponses calculées à
 * la demande change (`server/responses.ts`, et celles de l'API). 2 : les prix rendent une clé par
 * carte demandée, `null` sans prix (octobre 2026). 3 : le prix d'une carte suit la règle de
 * Pokécardex, et son troisième nombre est son prix d'il y a 30 jours (octobre 2026).
 */
export const API_FORMAT = 3
