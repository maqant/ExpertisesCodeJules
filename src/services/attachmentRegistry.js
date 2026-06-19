/**
 * REGISTRE DES TYPES DE PIÈCES JOINTES.
 *
 * Chaque type déclare :
 *  - extractKeys : comment retrouver les dbKey à purger dans le stockage,
 *                  à partir de l'état courant + des identifiants reçus.
 *  - removeFromState : comment muter l'état (fonction de réduction pure).
 *
 * Pour ajouter un module futur (ex: "postSinistre"),
 * il SUFFIT d'ajouter une entrée ici. Aucune autre couche ne change.
 */

export const ATTACHMENT_TYPES = {
  CAUSE_TIMELINE: 'CAUSE_TIMELINE',
  ATTACHED_FILE: 'ATTACHED_FILE',
  PHOTO: 'PHOTO',
  FREE_ANNEX: 'FREE_ANNEX',
  INTERVENANT: 'INTERVENANT' // We will add this to unify the intervenant deletion since it was in the user's example
};

/**
 * @typedef {Object} AttachmentDescriptor
 * @property {(state: object, payload: object) => string[]} extractKeys
 * @property {(state: object, payload: object) => object} removeFromState
 */

/** @type {Record<string, AttachmentDescriptor>} */
export const attachmentRegistry = {
  // --- Rapports de cause (timeline) ---
  [ATTACHMENT_TYPES.CAUSE_TIMELINE]: {
    extractKeys: ({ causeTimeline }, { id }) => {
      const item = causeTimeline.find((i) => i.id === id);
      return item?.dbKey ? [item.dbKey] : [];
    },
    removeFromState: ({ causeTimeline }, { id }) => ({
      causeTimeline: causeTimeline.filter((i) => i.id !== id),
    }),
  },

  // --- Fichiers attachés à un document ---
  [ATTACHMENT_TYPES.ATTACHED_FILE]: {
    extractKeys: ({ attachedFiles }, { parentId, dbKey }) => {
      if (dbKey) return [dbKey];
      // Suppression de tout le groupe : on purge tous ses fichiers.
      return (attachedFiles[parentId] || []).map((f) => f.dbKey).filter(Boolean);
    },
    removeFromState: ({ attachedFiles }, { parentId, dbKey }) => {
      const next = { ...attachedFiles };
      if (!dbKey) {
        delete next[parentId];
        return { attachedFiles: next };
      }
      const updated = (next[parentId] || []).filter((f) => f.dbKey !== dbKey);
      if (updated.length === 0) delete next[parentId];
      else next[parentId] = updated;
      return { attachedFiles: next };
    },
  },

  // --- Photos par occupant ---
  [ATTACHMENT_TYPES.PHOTO]: {
    extractKeys: (_state, { dbKey }) => (dbKey ? [dbKey] : []),
    removeFromState: ({ attachedPhotos }, { parentId, dbKey }) => {
      const next = { ...attachedPhotos };
      const updated = (next[parentId] || []).filter((p) => p.dbKey !== dbKey);
      if (updated.length === 0) delete next[parentId];
      else next[parentId] = updated;
      return { attachedPhotos: next };
    },
  },

  // --- Annexes libres ---
  [ATTACHMENT_TYPES.FREE_ANNEX]: {
    extractKeys: ({ attachedFreeAnnexes }, { id }) => {
      const item = attachedFreeAnnexes.find((f) => f.id === id);
      return item?.dbKey ? [item.dbKey] : [];
    },
    removeFromState: ({ attachedFreeAnnexes }, { id }) => ({
      attachedFreeAnnexes: attachedFreeAnnexes.filter((f) => f.id !== id),
    }),
  },

  // --- Intervenants ---
  // Intervenants do not have blobs in localforage, they are just state items.
  // But routing them through the registry makes the UI perfectly uniform.
  [ATTACHMENT_TYPES.INTERVENANT]: {
    extractKeys: () => [],
    removeFromState: ({ intervenantsList }, { id }) => ({
      intervenantsList: intervenantsList.filter((i) => i.id !== id),
    }),
  }
};
