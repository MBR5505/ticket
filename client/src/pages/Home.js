import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

const Home = () => {
  return (
    <div>
      <h1>Welcome to the Helpdesk</h1>
      <Button as={Link} to="/faq">View FAQ</Button>
    </div>
  );
};

export default Home;