const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

// Protect all routes
router.use(protect);

// User dashboard
router.get('/dashboard', authorize('user', 'admin_requester'), dashboardController.getUserDashboard);

// User tickets page
router.get('/tickets', authorize('user'), dashboardController.getUserDashboard);

// User messages page
router.get('/messages', authorize('user'), (req, res) => {
  res.render('user/messages', {
    title: 'Messages',
    user: req.user,
    conversations: [],
    activePage: 'messages',
    formatTimeAgo: dashboardController.formatTimeAgo
  });
});

router.get('/faq', authorize('user'), (req, res) => {
  res.render('faq.ejs', {
    title: 'Frequently Asked Questions',
    user: req.user,
    activePage: 'faq'
  });
});

// User settings page
router.get('/settings', authorize('user', 'admin_requester'), dashboardController.getUserSettings);

// Update user settings
router.post('/settings/update', authorize('user', 'admin_requester'), dashboardController.updateUserSettings);

// Change password
router.post('/settings/password', authorize('user', 'admin_requester'), dashboardController.changePassword);

// Waiting page for admin requesters
router.get('/waiting', authorize('admin_requester'), dashboardController.getWaitingPage);

module.exports = router;
