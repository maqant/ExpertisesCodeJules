import React, { useState } from 'react';

export function PromptReviewModal({ kind, prompt, file, aiStatus, aiResult, aiError, onConfirm, onCancel }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Erreur lors de la copie du prompt", e);
    }
  };

  const getTitle = () => {
    switch (kind) {
      case 'cp': return 'Analyse du Contrat d\'Assurance (Conditions Particulières)';
      case 'frais': return 'Analyse de la Ligne de Frais / Devis / Facture';
      case 'cause': return 'Analyse de la Cause du Sinistre';
      case 'annexe': return 'Ajout et Titrage d\'Annexe Libre';
      default: return 'Analyse du Document';
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* En-tête de la Modale 1 */}
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="text-base font-bold text-white">Étape 1/2 — {getTitle()}</h2>
              {file && <p className="text-xs text-indigo-300 font-mono">Fichier : {file.name}</p>}
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors text-lg font-bold">✕</button>
        </div>

        {/* Corps de la Modale 1 */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Instruction & Prompt d'Analyse
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-xs font-bold transition-all shadow flex items-center gap-1.5"
              >
                <span>{copied ? '✓' : '📋'}</span>
                <span>{copied ? 'Copié !' : 'Copier le Prompt'}</span>
              </button>
            </div>
            <pre className="w-full bg-slate-950 border border-slate-800 text-indigo-200 p-3.5 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {prompt}
            </pre>
          </div>

          {/* Statut de l'analyse IA */}
          <div className="p-3.5 rounded-lg border text-xs font-medium flex items-center gap-3 bg-slate-800/80 border-slate-700">
            {aiStatus === 'running' && (
              <>
                <span className="text-lg animate-spin">⏳</span>
                <div className="text-slate-300">
                  <p className="font-bold text-indigo-300">Analyse IA en cours...</p>
                  <p className="text-[11px] text-slate-400">Vous pouvez copier le prompt ci-dessus ou attendre la fin de l'extraction.</p>
                </div>
              </>
            )}

            {aiStatus === 'ready' && (
              <>
                <span className="text-lg">✅</span>
                <div className="text-slate-300">
                  <p className="font-bold text-emerald-400">Analyse IA terminée avec succès !</p>
                  <p className="text-[11px] text-slate-400">Les données extraites pré-rempliront le formulaire à l'étape suivante.</p>
                </div>
              </>
            )}

            {aiStatus === 'error' && (
              <>
                <span className="text-lg">⚠️</span>
                <div className="text-slate-300">
                  <p className="font-bold text-amber-400">Extrait non disponible (saisie manuelle)</p>
                  <p className="text-[11px] text-slate-400">Vous pouvez continuer vers l'étape suivante pour compléter les champs manuellement.</p>
                </div>
              </>
            )}

            {aiStatus === 'idle' && (
              <>
                <span className="text-lg">📄</span>
                <div className="text-slate-300">
                  <p className="font-bold text-slate-200">Mode d'ingestion prêt</p>
                  <p className="text-[11px] text-slate-400">Cliquez sur Continuer pour accéder à l'étape 2.</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pied de la Modale 1 */}
        <div className="p-4 bg-slate-800/60 border-t border-slate-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-sm transition-colors"
          >
            Annuler / Fermer
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-sm shadow-lg transition-all flex items-center gap-2"
          >
            <span>{aiStatus === 'ready' ? 'Valider & Passer à l\'Étape 2 →' : 'Continuer →'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
