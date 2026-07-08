import React from 'react';
import SidebarLegacy from './SidebarLegacy';
import SidebarSlim from './SidebarSlim';
import SidebarAccordion from './SidebarAccordion';
import SidebarFloating from './SidebarFloating';
import SidebarCommandPalette from './SidebarCommandPalette';
import SidebarFocusMode from './SidebarFocusMode';
import { useSidebarUI } from '../context/SidebarUIContext';

const Sidebar = () => {
    // Le contexte SidebarUIContext est fourni par App.jsx
    const { uiMode } = useSidebarUI();

    // Mode 1: Slim & Expand (Icon Drawer)
    if (uiMode === 1) {
        return (
            <SidebarSlim>
                <SidebarLegacy />
            </SidebarSlim>
        );
    }

    // Mode 3: Accordion (Focus Mode)
    if (uiMode === 3) {
        return (
            <SidebarAccordion>
                <SidebarLegacy />
            </SidebarAccordion>
        );
    }

    // Mode 4: Floating Dock (Dynamic Island)
    if (uiMode === 4) {
        return (
            <SidebarFloating>
                <SidebarLegacy />
            </SidebarFloating>
        );
    }

    // Mode 5: Command Palette
    if (uiMode === 5) {
        return (
            <SidebarCommandPalette>
                <SidebarLegacy />
            </SidebarCommandPalette>
        );
    }

    // Mode 6: Dynamic Focus Mode
    if (uiMode === 6) {
        return (
            <SidebarFocusMode>
                <SidebarLegacy />
            </SidebarFocusMode>
        );
    }

    // Mode 0: Legacy (Fallback)
    return <SidebarLegacy />;
};

export default Sidebar;
