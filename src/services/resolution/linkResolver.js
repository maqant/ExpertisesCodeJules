// src/services/resolution/linkResolver.js

/**
 * Résolution des liens hiérarchiques Locataire -> Propriétaire.
 *
 * Service PUR : aucune dépendance store / IA / UI.
 * Entrée : population consolidée d'occupants (existants + nouveaux, déjà mergés).
 * Sortie : liste d'occupants avec les liens résolus appliqués si certitude élevée.
 */

const STATUTS_PROPRIETAIRE = ['Propriétaire', 'Propriétaire occupant', 'ACP'];

const CONFIDENCE = {
  AUTO_THRESHOLD: 0.7   // >= : liaison appliquée automatiquement (le match nom exact donne 0.75)
};

function normalizeName(s) {
  return (s ?? '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isProprietaire(occ) {
  return STATUTS_PROPRIETAIRE.includes(occ?.statut);
}

/**
 * Score [0..1] de correspondance entre un lien revendiqué et un propriétaire candidat.
 */
function scoreCandidate(link, candidate) {
  const linkNom = normalizeName(link.nom);
  if (!linkNom) return 0;

  const candNom = normalizeName(candidate.nom);
  if (!candNom) return 0;

  let score = 0;
  if (candNom === linkNom) score = 0.75;
  else if (candNom.includes(linkNom) || linkNom.includes(candNom)) score = 0.5;
  else return 0;

  // Bonus prénom si disponible des deux côtés
  const linkPrenom = normalizeName(link.prenom);
  const candPrenom = normalizeName(candidate.prenom);

  if (linkPrenom && candPrenom) {
    if (candPrenom === linkPrenom) score += 0.25;
    else if (candPrenom.includes(linkPrenom) || linkPrenom.includes(candPrenom)) score += 0.15;
    else score -= 0.2; // Pénalité si le prénom diffère
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Résout les liens dans une liste d'occupants.
 * Renvoie une nouvelle liste avec les liens mis à jour.
 */
export function resolveLinks(occupants) {
  if (!Array.isArray(occupants)) return [];

  const proprietaires = occupants.filter(isProprietaire);

  return occupants.map((occ) => {
    // On ne lie que les locataires qui n'ont pas encore de lien explicite validé manuellement
    if (occ.statut !== 'Locataire' || !occ.proprietaireLie || !occ.proprietaireLie.nom || occ.linkedProprietaireId) {
      return occ;
    }

    let bestScore = 0;
    let bestCandidateId = null;

    for (const prop of proprietaires) {
      // Pour éviter qu'un locataire soit lié à un proprio d'un autre étage de manière farfelue,
      // on pourrait donner un bonus si l'étage matche.
      const score = scoreCandidate(occ.proprietaireLie, prop);
      
      let finalScore = score;
      if (normalizeName(occ.etage) === normalizeName(prop.etage) && occ.etage) {
          finalScore += 0.1; 
      }

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestCandidateId = prop.id;
      }
    }

    if (bestScore >= CONFIDENCE.AUTO_THRESHOLD && bestCandidateId) {
      return {
        ...occ,
        linkedProprietaireId: bestCandidateId,
      };
    }

    return occ;
  });
}
