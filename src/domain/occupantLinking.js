// src/domain/occupantLinking.js
// Liaison métier Locataire → Propriétaire. Module PUR : pas d'IA, pas d'état, pas d'UI.
// Contrat : jamais d'échec silencieux — tout échec de liaison est tracé dans linkReport.

import { normalizeLastName } from './aiDataSchema';

/** Retire accents + titres + casse pour comparaison robuste. */
const normalizeForMatch = (raw) =>
  normalizeLastName(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isProprietaire = (statut) =>
  /propri[ée]taire/i.test(String(statut || ''));

const isLocataire = (statut) =>
  /locataire/i.test(String(statut || ''));

/**
 * Extrait le nom du propriétaire cible depuis les données IA d'un occupant.
 * Accepte : proprietaireLie en string, en objet { nom }, ou motif "locataire de X" dans le nom.
 * Retourne { targetName: string|null, cleanedNom: string|null (si le nom devait être nettoyé) }.
 */
export function extractOwnerTarget(occ) {
  const lie = occ?.proprietaireLie;
  if (typeof lie === 'string' && lie.trim()) {
    return { targetName: lie.trim(), cleanedNom: null };
  }
  if (lie && typeof lie === 'object' && lie.nom) {
    return { targetName: String(lie.nom).trim(), cleanedNom: null };
  }
  const nomOriginal = String(occ?.nom || '');
  const match = nomOriginal.match(/^(.*?)[\s,(-]*locataire\s+de\s+(.+?)[)\s]*$/i);
  if (match) {
    return {
      targetName: match[2].trim(),
      cleanedNom: match[1].trim() || null // préserve la casse originale
    };
  }
  return { targetName: null, cleanedNom: null };
}

/**
 * Tente de lier chaque locataire non lié à un propriétaire de la liste.
 * NE MUTE PAS l'entrée. Retourne { occupants, linkReport }.
 * linkReport = { linked: [{occupantId, occupantNom, proprietaireId, proprietaireNom}],
 *                unlinked: [{occupantId, occupantNom, targetName, reason}] }
 */
export function linkTenantsToOwners(inputOccupants) {
  const occupants = inputOccupants.map((o) => ({ ...o }));
  const linkReport = { linked: [], unlinked: [] };

  const owners = occupants.filter((p) => isProprietaire(p.statut));

  occupants.forEach((occ) => {
    if (!isLocataire(occ.statut)) {
      delete occ.proprietaireLie;
      return;
    }
    if (occ.linkedProprietaireId) {
      // Liaison existante (manuelle ou persistée) : intouchable.
      delete occ.proprietaireLie;
      return;
    }

    const { targetName, cleanedNom } = extractOwnerTarget(occ);
    if (cleanedNom !== null) occ.nom = cleanedNom;
    delete occ.proprietaireLie;

    if (!targetName) {
      // Un locataire normal sans propriétaire indiqué (pas d'erreur).
      return;
    }

    const normTarget = normalizeForMatch(targetName);
    if (!normTarget) {
      linkReport.unlinked.push({
        occupantId: occ.id,
        occupantNom: occ.nom,
        targetName,
        reason: 'NOM_PROPRIETAIRE_VIDE_APRES_NORMALISATION'
      });
      return;
    }

    const candidates = owners.filter((p) => {
      if (p.id === occ.id) return false;
      const normOwner = normalizeForMatch(p.nom);
      return normOwner && (normOwner.includes(normTarget) || normTarget.includes(normOwner));
    });

    if (candidates.length === 1) {
      occ.linkedProprietaireId = candidates[0].id;
      linkReport.linked.push({
        occupantId: occ.id,
        occupantNom: occ.nom,
        proprietaireId: candidates[0].id,
        proprietaireNom: candidates[0].nom
      });
    } else if (candidates.length === 0) {
      linkReport.unlinked.push({
        occupantId: occ.id,
        occupantNom: occ.nom,
        targetName,
        reason: 'PROPRIETAIRE_INTROUVABLE'
      });
    } else {
      // Ambiguïté : on NE devine PAS. L'utilisateur tranchera (fiabilité > automatisme).
      linkReport.unlinked.push({
        occupantId: occ.id,
        occupantNom: occ.nom,
        targetName,
        reason: 'PLUSIEURS_PROPRIETAIRES_CANDIDATS'
      });
    }
  });

  return { occupants, linkReport };
}
