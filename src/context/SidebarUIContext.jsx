import React, { createContext, useContext, useState } from 'react';

const SidebarUIContext = createContext();

export const SidebarUIProvider = ({ children }) => {
    const [uiMode, setUiMode] = useState(0); // Mode 0 (Legacy) par défaut
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isAckModalOpen, setIsAckModalOpen] = useState(false);

    // Modales flottantes globales
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isLoadDossierModalOpen, setIsLoadDossierModalOpen] = useState(false);
    const [isQuickDecompteOpen, setIsQuickDecompteOpen] = useState(false);

    // Bascule propre depuis Settings vers Dossiers
    const openDossiersFromSettings = () => {
        setIsSettingsModalOpen(false);
        setIsLoadDossierModalOpen(true);
    };

    return (
        <SidebarUIContext.Provider value={{
            uiMode, setUiMode,
            isDrawerOpen, setIsDrawerOpen,
            isAckModalOpen, setIsAckModalOpen,
            isSettingsModalOpen, setIsSettingsModalOpen,
            isLoadDossierModalOpen, setIsLoadDossierModalOpen,
            isQuickDecompteOpen, setIsQuickDecompteOpen,
            openDossiersFromSettings
        }}>
            {children}
        </SidebarUIContext.Provider>
    );
};

export const useSidebarUI = () => useContext(SidebarUIContext);
