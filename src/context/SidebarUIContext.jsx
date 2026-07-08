import React, { createContext, useContext, useState } from 'react';

const SidebarUIContext = createContext();

export const SidebarUIProvider = ({ children }) => {
    // Modes définis:
    // 0: Legacy (barre latérale classique)
    // 1: Slim & Expand (Icon Drawer)
    // 2: Accordion (Focus Mode) - à venir
    // 3: Floating Dock (Dynamic Island) - à venir
    const [uiMode, setUiMode] = useState(0); // Mode 0 (Legacy) par défaut
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    return (
        <SidebarUIContext.Provider value={{ uiMode, setUiMode, isDrawerOpen, setIsDrawerOpen }}>
            {children}
        </SidebarUIContext.Provider>
    );
};

export const useSidebarUI = () => useContext(SidebarUIContext);
