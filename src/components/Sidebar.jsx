import React from 'react';
import SidebarLegacy from './SidebarLegacy';
import SidebarFocusMode from './SidebarFocusMode';

const Sidebar = () => {
    return (
        <SidebarFocusMode>
            <SidebarLegacy />
        </SidebarFocusMode>
    );
};

export default Sidebar;
