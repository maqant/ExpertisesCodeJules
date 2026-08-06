import React, { createContext, useContext, useState } from 'react';

const SidebarUIContext = createContext();

export const SidebarUIProvider = ({ children }) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isAckModalOpen, setIsAckModalOpen] = useState(false);

    // Modales flottantes globales
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isLoadDossierModalOpen, setIsLoadDossierModalOpen] = useState(false);
    const [isQuickDecompteOpen, setIsQuickDecompteOpen] = useState(false);

    // Modale globale Gestionnaire Financier (Decompte Splitter)
    const [isDecompteSplitterOpen, setIsDecompteSplitterOpen] = useState(false);
    const [decompteSplitterFiles, setDecompteSplitterFiles] = useState([]);

    const openDecompteSplitterWithFiles = (files) => {
        setDecompteSplitterFiles(files || []);
        setIsDecompteSplitterOpen(true);
    };

    const closeDecompteSplitter = () => {
        setIsDecompteSplitterOpen(false);
        setDecompteSplitterFiles([]);
    };

    // Bascule propre depuis Settings vers Dossiers
    const openDossiersFromSettings = () => {
        setIsSettingsModalOpen(false);
        setIsLoadDossierModalOpen(true);
    };

    return (
        <SidebarUIContext.Provider value={{
            isDrawerOpen, setIsDrawerOpen,
            isAckModalOpen, setIsAckModalOpen,
            isSettingsModalOpen, setIsSettingsModalOpen,
            isLoadDossierModalOpen, setIsLoadDossierModalOpen,
            isQuickDecompteOpen, setIsQuickDecompteOpen,
            isDecompteSplitterOpen, setIsDecompteSplitterOpen,
            decompteSplitterFiles, setDecompteSplitterFiles,
            openDecompteSplitterWithFiles, closeDecompteSplitter,
            openDossiersFromSettings
        }}>
            {children}
        </SidebarUIContext.Provider>
    );
};

export const useSidebarUI = () => useContext(SidebarUIContext);
