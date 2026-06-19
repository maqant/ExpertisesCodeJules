/**
 * goldenDiff.js
 */

import { getFieldMeta, CRITICALITY, ERROR_CATEGORIES } from './fieldRegistry.js';

const countStatuses = (items = []) => {
    return items.reduce((acc, item) => {
        const status = item._status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
};

/**
 * Compare la sortie IA et la validation utilisateur pour générer un diff structuré.
 * @param {Object} params
 * @param {Object} params.aiOutput
 * @param {Object} params.userCorrection
 * @returns {Object} { diffSummary, fieldDiffs }
 */
export const buildGoldenDiff = ({ aiOutput, userCorrection }) => {
    try {
        const fieldDiffs = [];
        const changedFormFields = [];

        const aiForm = aiOutput?.formData || {};
        const userForm = userCorrection?.formData || {};

        const keys = new Set([...Object.keys(aiForm), ...Object.keys(userForm)]);

        for (const key of keys) {
            const aiValue = aiForm[key] ?? null;
            const userValue = userForm[key] ?? null;

            if (String(aiValue ?? '').trim() !== String(userValue ?? '').trim()) {
                changedFormFields.push(key);
                
                const meta = getFieldMeta(key);
                fieldDiffs.push({
                    path: `formData.${key}`,
                    aiValue,
                    userValue,
                    changeType: aiValue == null ? 'added_by_user' : userValue == null ? 'removed_by_user' : 'changed',
                    severity: meta.criticality,
                    category: meta.category
                });
            }
        }

        const diffSummary = {
            changedFormFields,
            hasCriticalAdminChange: changedFormFields.some(k => getFieldMeta(k).criticality === CRITICALITY.CRITICAL && getFieldMeta(k).category === ERROR_CATEGORIES.ADMIN),
            rejectedCounts: {
                occupants: countStatuses(userCorrection?.occupants).rejected || 0,
                expenses: countStatuses(userCorrection?.expenses).rejected || 0,
                intervenants: countStatuses(userCorrection?.intervenants).rejected || 0,
                experts: countStatuses(userCorrection?.experts).rejected || 0
            },
            keptCounts: {
                occupants: countStatuses(userCorrection?.occupants).kept || 0,
                expenses: countStatuses(userCorrection?.expenses).kept || 0,
                intervenants: countStatuses(userCorrection?.intervenants).kept || 0,
                experts: countStatuses(userCorrection?.experts).kept || 0
            }
        };

        return { diffSummary, fieldDiffs, _diffError: false };
    } catch (err) {
        console.error("[GoldenDiff] Erreur lors du calcul du diff :", err);
        return { diffSummary: {}, fieldDiffs: [], _diffError: true };
    }
};
