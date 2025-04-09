const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { protect, authorize } = require('../middleware/auth');
const { ticketUpload } = require('../config/upload');

// All routes need authentication
router.use(protect);

// Create ticket route - with file uploads
router.post('/create', ticketUpload.array('attachments', 5), ticketController.createTicket);

// Get ticket by ID for user
router.get('/user/:id', ticketController.getTicketById);

// Get ticket by ID for admin
router.get('/admin/:id', authorize('admin', 'head_admin'), ticketController.getTicketById);

// Update ticket status
router.put('/:id/status', authorize('admin', 'head_admin'), ticketController.updateTicketStatus);

// Update ticket priority
router.put('/:id/priority', authorize('admin', 'head_admin'), ticketController.updateTicketPriority);

// Assign ticket to admin
router.put('/:id/assign', authorize('admin', 'head_admin'), ticketController.assignTicket);

// Add documentation to resolved ticket
router.post('/:id/documentation', authorize('admin', 'head_admin'), ticketController.addDocumentation);

// Add attachment to ticket
router.post('/:id/attachments', ticketUpload.array('attachments', 5), ticketController.addAttachment);

// Delete attachment
router.delete('/:id/attachments/:attachmentId', ticketController.deleteAttachment);

module.exports = router;
