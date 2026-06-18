// src/services/utils/contactUtils.js

/**
 * Extrait et déduplique les adresses e-mails d'une liste de parties (occupants, courtiers, etc.)
 * @param {Array} parties - Liste des objets représentant les parties, contenant potentiellement une propriété `email`
 * @returns {string} - Liste des e-mails séparés par un point-virgule (format prêt pour Outlook)
 */
export const extractEmailsForOutlook = (parties = []) => {
    if (!Array.isArray(parties)) return '';

    const emails = parties
        .map(p => p.email)
        .filter(email => typeof email === 'string' && email.trim() !== '');

    // Déduplication
    const uniqueEmails = [...new Set(emails)];

    return uniqueEmails.join('; ');
};
