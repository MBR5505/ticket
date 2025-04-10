const express = require('express');
const router = express.Router();

// Add FAQ route
router.get('/faq', (req, res) => {
  res.render('faq', {
    title: 'Frequently Asked Questions',
    user: req.session.user || null
  });
});

module.exports = router;