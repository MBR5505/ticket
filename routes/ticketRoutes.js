const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ticketController = require('../controllers/ticketController');

// All routes need authentication
router.use(protect);

// Create a new ticket
router.post('/create', authorize('user'), ticketController.createTicket);

// Get ticket by ID for user
router.get('/user/:id', authorize('user'), ticketController.getTicketById);

// Get ticket by ID for admin
router.get('/admin/:id', authorize('admin', 'head_admin'), ticketController.getTicketById);

// Update ticket status (admin only)
router.put('/:id/status', authorize('admin', 'head_admin'), ticketController.updateTicketStatus);

// Update ticket priority (admin only)
router.put('/:id/priority', authorize('admin', 'head_admin'), ticketController.updateTicketPriority);

// Assign ticket to admin (admin only)
router.put('/:id/assign', authorize('admin', 'head_admin'), ticketController.assignTicket);

// Add documentation to ticket (admin only)
router.post('/:id/documentation', authorize('admin', 'head_admin'), ticketController.addDocumentation);

// Get ticket statistics (admin only)
router.get('/statistics', authorize('admin', 'head_admin'), ticketController.getStatistics);

module.exports = router;
