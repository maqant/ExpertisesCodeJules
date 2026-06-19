import React from 'react';

const ConflictModal = ({ isOpen, onReload, onOverwrite }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-red-500 rounded-xl p-8 max-w-lg w-full shadow-2xl shadow-red-500/20">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-red-500/20 p-3 rounded-full">
            <span className="text-red-500 text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Conflit Détecté</h2>
        </div>
        
        <div className="space-y-4 mb-8 text-gray-300">
          <p>
            Ce dossier a été <strong>modifié et sauvegardé depuis un autre onglet</strong> pendant que vous travailliez ici.
          </p>
          <p className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-sm">
            Si vous forcez la sauvegarde, <strong>les données de l'autre onglet seront définitivement écrasées</strong> et perdues.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <button
            onClick={onOverwrite}
            className="px-6 py-3 rounded-lg font-medium text-red-500 border border-red-500/50 hover:bg-red-500/10 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            Forcer et écraser
          </button>
          <button
            onClick={onReload}
            className="px-6 py-3 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#1A1A1A] focus:outline-none"
          >
            Recharger les dernières données
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal;
