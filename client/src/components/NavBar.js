import React from 'react';
import { Nav, NavItem, NavLink } from 'reactstrap';

// ...existing code...

const NavBar = () => {
  // ...existing code...
  
  return (
    <Nav>
      {/* ...existing code... */}
      <NavItem>
        <NavLink to="/faq">FAQ</NavLink>
      </NavItem>
      {/* ...existing code... */}
    </Nav>
  );
};

// ...existing code...

export default NavBar;