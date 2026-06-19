/**
 * telemetryUtils.js
 */

/**
 * Construit un identifiant stable et standardisé pour un champ.
 * @param {Object} params
 * @param {string} params.entityType - Ex: 'formData', 'occupant', 'expense', 'intervenant'
 * @param {string|number|null} params.entityId - Ex: l'ID ou l'index de l'entité dans sa liste
 * @param {string} params.fieldName - Ex: 'franchise', 'montantReclame'
 * @returns {string} - Ex: 'formData.franchise' ou 'occupant.1234.statut'
 */
export const buildTelemetryFieldId = ({ entityType, entityId = null, fieldName }) => {
    if (!entityType || !fieldName) return 'field.unknown';
    return entityId !== null
        ? `${entityType}.${entityId}.${fieldName}`
        : `${entityType}.${fieldName}`;
};
