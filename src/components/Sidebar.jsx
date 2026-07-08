import React from 'react';
import SidebarLegacy from './SidebarLegacy';
import SidebarSlim from './SidebarSlim';
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

    // Mode 0: Legacy (Fallback)
    return <SidebarLegacy />;
};

export default Sidebar;
