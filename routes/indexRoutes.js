const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const faqController = require('../controllers/faqController');

// Homepage route
router.get('/', indexController.getHomePage);

// FAQ route
router.get('/faq', faqController.getFaqPage);

// Contact page
router.get('/contact', indexController.getContactPage);
router.post('/contact', indexController.submitContactForm);

// Error handling
router.get('/error', indexController.getErrorPage);

// Static pages
router.get('/terms', indexController.getTermsPage);
router.get('/privacy', indexController.getPrivacyPage);

module.exports = router;
