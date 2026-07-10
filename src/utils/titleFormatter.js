/**
 * Utilitaire de formatage pour les titres de rapport.
 */

/**
 * Formate le titre canonique d'une expertise à partir des données de formulaire.
 * Format cible : "Expertise du [Date] à [Heure] - [Réf] - [Résidence]"
 * 
 * @param {Object} formData - Les données du formulaire
 * @returns {string} Le titre formaté
 */
export function formatExpertiseTitle(formData = {}) {
    const datePart = formData.dateExp 
        ? `Expertise du ${new Date(formData.dateExp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${formData.heureExp ? ` à ${formData.heureExp.replace(':', 'h')}` : ''}`
        : 'Expertise du ...';
    
    const refPart = formData.refPechard ? `- ${formData.refPechard}` : '';
    const residencePart = formData.nomResidence ? `- ${formData.nomResidence}` : '';

    return `${datePart} ${refPart} ${residencePart}`.replace(/\s+/g, ' ').trim();
}
