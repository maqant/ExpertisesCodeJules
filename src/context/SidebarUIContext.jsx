import React, { createContext, useContext, useState } from 'react';

const SidebarUIContext = createContext();

export const SidebarUIProvider = ({ children }) => {
    // Modes définis:
    // 0: Legacy (barre latérale classique)
    // 1: Slim & Expand (Icon Drawer)
    // 3: Accordion (Focus Mode)
    // 4: Floating (Island)
    // 5: Command (Palette)
    // 6: Focus
    const [uiMode, setUiMode] = useState(0); // Mode 0 (Legacy) par défaut
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isAckModalOpen, setIsAckModalOpen] = useState(false);

    return (
        <SidebarUIContext.Provider value={{
            uiMode,
            setUiMode,
            isDrawerOpen,
            setIsDrawerOpen,
            isAckModalOpen,
            setIsAckModalOpen
        }}>
            {children}
        </SidebarUIContext.Provider>
    );
};

export const useSidebarUI = () => useContext(SidebarUIContext);
