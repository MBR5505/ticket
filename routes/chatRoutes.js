const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/auth');
const { chatUpload } = require('../config/upload');

// All routes need authentication
router.use(protect);

// User chat routes
router.get('/messages', chatController.getUserMessages);
router.get('/conversation/:userId', chatController.createOrGetChat);
router.post('/conversation', chatController.createOrGetChat);
router.post('/mark-read/:userId', chatController.markMessagesAsRead);

// Chat waiting page
router.get('/waiting', chatController.getWaitingPage);

// Admin chat routes
router.get('/admin/messages', authorize('admin', 'head_admin'), chatController.getAdminMessages);
router.get('/admin/queue', authorize('admin', 'head_admin'), chatController.getAdminQueue);
router.post('/admin/accept', authorize('admin', 'head_admin'), chatController.acceptChatRequest);
router.post('/admin/decline', authorize('admin', 'head_admin'), chatController.declineChatRequest);
router.post('/admin/end', authorize('admin', 'head_admin'), chatController.endChat);

// Send message (with file attachment)
router.post('/send', chatUpload.array('attachments', 3), chatController.sendMessage);

// Get ticket messages
router.get('/ticket/:ticketId', chatController.getTicketMessages);

module.exports = router;
