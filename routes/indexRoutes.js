const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Home page
router.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});

// Redirect based on user role
router.get('/dashboard', protect, (req, res) => {
  // Redirect to appropriate dashboard based on user role
  if (req.user.role === 'admin_requester') {
    return res.redirect('/user/waiting');
  } else if (req.user.role === 'user') {
    return res.redirect('/user/dashboard');
  } else {
    return res.redirect('/admin/dashboard');
  }
});

module.exports = router;
