const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// All routes need authentication
router.use(protect);

// User routes
router.get('/conversation/:userId', authorize('user', 'admin', 'head_admin'), chatController.createOrGetChat);
router.post('/new-conversation', authorize('user'), chatController.createOrGetChat);
router.post('/send', authorize('user', 'admin', 'head_admin'), chatController.sendMessage);

// Get messages for a ticket
router.get('/ticket/:ticketId', authorize('user', 'admin', 'head_admin'), chatController.getTicketMessages);

// Admin routes
router.get('/admin/chat/:userId', authorize('admin', 'head_admin'), chatController.createOrGetChat);
router.get('/admin/messages', authorize('admin', 'head_admin'), chatController.getAdminMessages);

module.exports = router;
