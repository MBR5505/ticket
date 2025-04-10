import React from 'react';
import { Link } from 'react-router-dom';
import { FooterLink } from './FooterStyles';

const Footer = () => {
  return (
    <footer>
      <FooterLink as={Link} to="/faq">FAQ</FooterLink>
      {/* ...other links... */}
    </footer>
  );
};

export default Footer;