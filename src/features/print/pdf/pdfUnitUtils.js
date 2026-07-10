/**
 * Utilitaire de conversion des unités pour le moteur d'impression PDF.
 */

/**
 * Convertit une valeur en millimètres (mm) en points de typographie (pt).
 * 1 pouce = 72 pt = 25.4 mm
 * 
 * @param {number|string} mmValue - Valeur en millimètres à convertir
 * @returns {number} Valeur convertie en points absolus
 */
export function mmToPt(mmValue) {
    const mm = parseFloat(mmValue);
    if (isNaN(mm) || mm <= 0) {
        return 28.346456693; // 10 mm en pt par défaut (72 / 2.54)
    }
    const clamped = Math.max(1, Math.min(mm, 100)); // Borne de sécurité entre 1 mm et 100 mm
    return clamped * (72 / 25.4);
}
