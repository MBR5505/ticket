import React from 'react';
import { Link } from 'react-router-dom';
import { SidebarItem, SidebarIcon, SidebarLabel } from './SidebarComponents';

const Sidebar = () => {
  return (
    <div className="sidebar">
      {/* ...existing code... */}
      <SidebarItem as={Link} to="/faq">
        <SidebarIcon>[Icon]</SidebarIcon>
        <SidebarLabel>FAQ</SidebarLabel>
      </SidebarItem>
      {/* ...existing code... */}
    </div>
  );
};

export default Sidebar;