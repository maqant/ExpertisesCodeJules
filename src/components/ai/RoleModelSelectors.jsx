import React, { useMemo } from 'react';
import { AI_ROLES, AI_ROLE_META, MODEL_CATALOG, isValidModelId } from '../../ai/ai.catalog.js';

/**
 * Sélecteurs de modèle par rôle IA (Extraction / Synthèse / Affinage).
 * Changer un rôle bascule TOUS les processus héritants de ce rôle,
 * sans jamais toucher aux overrides individuels (épinglés).
 *
 * Composant pur et contrôlé : aucun accès au contexte, aucun état local.
 *
 * @param {Object} props
 * @param {Record<string,string>} props.roles - aiConfig.roles (roleId -> modelId)
 * @param {Record<string,string>} props.processOverrides - aiConfig.processOverrides (processId -> modelId)
 * @param {Array<{id: string, role: string}>} props.processes - liste plate des processus
 * @param {(roleId: string, modelId: string) => void} props.onRoleModelChange
 */
export default function RoleModelSelectors({
    roles = {},
    processOverrides = {},
    processes = [],
    onRoleModelChange,
}) {
    // Comptage par rôle : combien héritent, combien sont épinglés (override actif).
    const statsByRole = useMemo(() => {
        const stats = {};
        for (const role of Object.values(AI_ROLES)) {
            stats[role] = { inheriting: 0, pinned: 0 };
        }
        for (const process of processes) {
            const bucket = stats[process?.role];
            if (!bucket) continue; // rôle inconnu : ignoré, jamais compté à tort
            if (isValidModelId(processOverrides[process.id])) bucket.pinned += 1;
            else bucket.inheriting += 1;
        }
        return stats;
    }, [processes, processOverrides]);

    const handleChange = (roleId) => (event) => {
        const modelId = event.target.value;
        if (!isValidModelId(modelId)) {
            // Zéro erreur silencieuse : un id invalide ne doit jamais partir vers la config.
            console.error(`[RoleModelSelectors] Modèle invalide ignoré: "${modelId}" pour le rôle "${roleId}"`);
            return;
        }
        onRoleModelChange(roleId, modelId);
    };

    return (
        <div className="flex flex-col gap-3 mb-6 p-3 bg-slate-800/50 rounded border border-slate-700/50" role="group" aria-label="Modèles par rôle">
            <p className="text-xs text-slate-400">
                💡 Changez le modèle par défaut pour toute une catégorie d'agents. Les agents ayant une configuration personnalisée n'en seront pas affectés.
            </p>
            <div className="grid grid-cols-1 gap-3">
                {Object.values(AI_ROLES).map((roleId) => {
                    const meta = AI_ROLE_META[roleId] ?? { label: roleId, description: '' };
                    const currentModel = roles[roleId];
                    const selectValue = isValidModelId(currentModel) ? currentModel : '';
                    const { inheriting, pinned } = statsByRole[roleId];
                    const selectId = `role-model-${roleId}`;

                    return (
                        <div key={roleId} className="flex flex-col gap-1">
                            <div className="flex justify-between items-end">
                                <label htmlFor={selectId} className="text-xs font-bold text-slate-300" title={meta.description}>
                                    {meta.label}
                                </label>
                                <span className="text-[9px] text-slate-500">
                                    {inheriting} héritant{inheriting > 1 ? 's' : ''}
                                    {pinned > 0 && ` · ${pinned} épinglé${pinned > 1 ? 's' : ''}`}
                                </span>
                            </div>
                            <select
                                id={selectId}
                                value={selectValue}
                                onChange={handleChange(roleId)}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white focus:border-indigo-500 outline-none text-[11px]"
                            >
                                {selectValue === '' && (
                                    <option value="" disabled>— Modèle invalide, choisir —</option>
                                )}
                                {Object.values(MODEL_CATALOG).map((model) => (
                                    <option key={model.id} value={model.id}>{model.label}</option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
