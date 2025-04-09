const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

// All routes need authentication
router.use(protect);

// User dashboard routes
router.get('/user/dashboard', dashboardController.getUserDashboard);
router.get('/user/tickets', dashboardController.getUserTickets);
router.get('/user/settings', dashboardController.getUserSettings);

// Admin dashboard routes
router.get('/admin/dashboard', authorize('admin', 'head_admin'), dashboardController.getAdminDashboard);
router.get('/admin/tickets', authorize('admin', 'head_admin'), dashboardController.getAdminTickets);
router.get('/admin/tickets/assigned', authorize('admin', 'head_admin'), dashboardController.getAssignedTickets);
router.get('/admin/messages', authorize('admin', 'head_admin'), dashboardController.getAdminMessages);
router.get('/admin/statistics', authorize('admin', 'head_admin'), dashboardController.getAdminStatistics);
router.get('/admin/users', authorize('head_admin'), dashboardController.getAdminUsers);
router.get('/admin/staff', authorize('admin', 'head_admin'), dashboardController.getAdminStaff);
router.get('/admin/settings', authorize('admin', 'head_admin'), dashboardController.getAdminSettings);

// Update settings
router.post('/user/settings/update', dashboardController.updateUserSettings);
router.post('/user/settings/password', dashboardController.updateUserPassword);
router.post('/admin/settings/update', authorize('admin', 'head_admin'), dashboardController.updateAdminSettings);

// Norwegian route aliases (redirects to English routes)
router.get('/bruker/oversikt', (req, res) => res.redirect('/user/dashboard'));
router.get('/bruker/saker', (req, res) => res.redirect('/user/tickets'));
router.get('/bruker/innstillinger', (req, res) => res.redirect('/user/settings'));
router.get('/admin/oversikt', (req, res) => res.redirect('/admin/dashboard'));
router.get('/admin/saker', (req, res) => res.redirect('/admin/tickets'));
router.get('/admin/statistikk', (req, res) => res.redirect('/admin/statistics'));
router.get('/admin/brukere', (req, res) => res.redirect('/admin/users'));
router.get('/admin/ansatte', (req, res) => res.redirect('/admin/staff'));
router.get('/admin/innstillinger', (req, res) => res.redirect('/admin/settings'));

module.exports = router;
