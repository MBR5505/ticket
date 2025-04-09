const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/auth');
const { chatUpload } = require('../config/upload');

// All routes need authentication
router.use(protect);

// Get user messages page
router.get('/messages', chatController.getUserMessages);

// Get admin messages page
router.get('/admin/messages', authorize('admin', 'head_admin'), chatController.getAdminMessages);

// Create or get chat
router.post('/conversation/:userId?', chatController.createOrGetChat);
router.get('/conversation/:userId', chatController.createOrGetChat);

// Send message (with file attachment)
router.post('/send', chatUpload.array('attachments', 3), chatController.sendMessage);

// Get ticket messages
router.get('/ticket/:ticketId', chatController.getTicketMessages);

module.exports = router;
