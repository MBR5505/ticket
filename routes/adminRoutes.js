const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const dashboardController = require('../controllers/dashboardController');
const ticketController = require('../controllers/ticketController');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// All routes need authentication
router.use(protect);

// Dashboard routes
router.get('/dashboard', authorize('admin', 'head_admin'), dashboardController.getAdminDashboard);

// Ticket routes
router.get('/tickets', authorize('admin', 'head_admin'), ticketController.getAllTickets);

// Statistics route
router.get('/statistics', authorize('admin', 'head_admin'), adminController.getAdminStats);

// User management routes (head admin only)
router.get('/users', authorize('head_admin'), adminController.getAllUsers);
router.post('/users', authorize('head_admin'), adminController.createUser);
router.put('/users/:userId/role', authorize('head_admin'), adminController.updateUserRole);
router.post('/users/:userId/approve', authorize('head_admin'), adminController.approveAdminRequest);
router.post('/users/:userId/deny', authorize('head_admin'), adminController.denyAdminRequest);

// Get user ticket count (for user management)
router.get('/users/:userId/ticket-count', authorize('head_admin'), async (req, res) => {
  try {
    const count = await Ticket.countDocuments({ user: req.params.userId });
    res.json({ success: true, count });
  } catch (error) {
    console.error('Get ticket count error:', error);
    res.status(500).json({ success: false, message: 'Error fetching ticket count' });
  }
});

// Get user details with statistics (for user management)
router.get('/users/:userId/details', authorize('head_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get ticket statistics
    const tickets = await Ticket.find({ user: req.params.userId }).sort('-createdAt');
    const ticketStats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      resolved: tickets.filter(t => t.status === 'resolved').length
    };
    
    // Get admin stats if user is admin
    let adminStats = {};
    if (user.role === 'admin' || user.role === 'head_admin') {
      const assignedTickets = await Ticket.find({ assignedTo: user._id });
      adminStats = {
        assignedTotal: assignedTickets.length,
        resolved: assignedTickets.filter(t => t.status === 'resolved').length,
        avgResolutionTime: calculateAvgResolutionTime(assignedTickets)
      };
    }
    
    res.json({
      success: true,
      user,
      tickets,
      ticketStats,
      adminStats
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper function for calculating average resolution time
function calculateAvgResolutionTime(tickets) {
  if (!tickets || tickets.length === 0) return 0;
  
  let totalHours = 0;
  let resolvedCount = 0;
  
  tickets.forEach(ticket => {
    if (ticket.status === 'resolved' && ticket.createdAt && ticket.updatedAt) {
      const diffTime = ticket.updatedAt - ticket.createdAt;
      totalHours += diffTime / (1000 * 60 * 60); // Convert to hours
      resolvedCount++;
    }
  });
  
  return resolvedCount > 0 ? totalHours / resolvedCount : 0;
}

// Statistics for specific period
router.get('/statistics/period/:days', authorize('admin', 'head_admin'), async (req, res) => {
  try {
    const days = parseInt(req.params.days);
    if (isNaN(days) || days <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid days parameter' });
    }
    
    // Get data for specified period
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    // Get basic stats
    const total = await Ticket.countDocuments({ createdAt: { $gte: date } });
    const open = await Ticket.countDocuments({ status: 'open', createdAt: { $gte: date } });
    const inProgress = await Ticket.countDocuments({ status: 'in_progress', createdAt: { $gte: date } });
    const resolved = await Ticket.countDocuments({ status: 'resolved', createdAt: { $gte: date } });
    
    res.json({
      success: true,
      stats: {
        total,
        open,
        inProgress,
        resolved
      }
    });
  } catch (error) {
    console.error('Get period statistics error:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// Export data routes
router.get('/export/tickets', authorize('admin', 'head_admin'), async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('user', 'name email')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });
    
    // Set headers for csv download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets_export.csv');
    
    // Create CSV header
    let csv = 'ID,Title,Description,Status,Priority,Category,User,User Email,Assigned To,Created,Updated\n';
    
    // Add each ticket as a row
    tickets.forEach(ticket => {
      csv += `"${ticket._id}",`;
      csv += `"${ticket.title.replace(/"/g, '""')}",`;
      csv += `"${ticket.description.replace(/"/g, '""')}",`;
      csv += `"${ticket.status}",`;
      csv += `"${ticket.priority}",`;
      csv += `"${ticket.category}",`;
      csv += `"${ticket.user ? ticket.user.name.replace(/"/g, '""') : ''}",`;
      csv += `"${ticket.user ? ticket.user.email : ''}",`;
      csv += `"${ticket.assignedTo ? ticket.assignedTo.name.replace(/"/g, '""') : ''}",`;
      csv += `"${ticket.createdAt}",`;
      csv += `"${ticket.updatedAt}"\n`;
    });
    
    res.send(csv);
  } catch (error) {
    console.error('Export tickets error:', error);
    res.status(500).json({ success: false, message: 'Error exporting tickets' });
  }
});

router.get('/export/performance', authorize('head_admin'), (req, res) => {
  // Implementation for exporting performance data
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=admin_performance.csv');
  
  // Send CSV data
  // For now, we'll just send a simple placeholder
  res.send('Admin,Assigned,Resolved,Resolution Time\n');
});

// Admin settings routes
router.get('/settings', authorize('admin', 'head_admin'), adminController.getAdminSettings);
router.post('/settings/update', authorize('admin', 'head_admin'), adminController.updateAdminSettings);

// Staff management routes
router.get('/staff', authorize('head_admin'), adminController.getStaffPage);
router.post('/users/add', authorize('head_admin'), adminController.addAdmin);
router.post('/users/:id/update', authorize('head_admin'), adminController.updateAdminById);
router.get('/users/:id/performance', authorize('head_admin'), adminController.getAdminPerformance);

module.exports = router;
