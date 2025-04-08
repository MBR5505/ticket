const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const dashboardController = require('../controllers/dashboardController');
const ticketController = require('../controllers/ticketController');

// All routes need authentication
router.use(protect);

// All routes are for admins and head admins only
router.use(authorize('admin', 'head_admin'));

// Dashboard routes
router.get('/dashboard', dashboardController.getAdminDashboard);

// Ticket routes
router.get('/tickets', ticketController.getAllTickets);

// User management routes (head admin only)
router.get('/users', authorize('head_admin'), adminController.getAllUsers);
router.post('/users', authorize('head_admin'), adminController.createUser);
router.put('/users/:id/role', authorize('head_admin'), adminController.updateUserRole);
router.post('/users/:id/approve', authorize('head_admin'), adminController.approveAdminRequest);
router.post('/users/:id/deny', authorize('head_admin'), adminController.denyAdminRequest);

// Get user ticket count (for user management)
router.get('/users/:id/ticket-count', authorize('head_admin'), async (req, res) => {
  try {
    const count = await Ticket.countDocuments({ user: req.params.id });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching ticket count' });
  }
});

// Get user details with statistics (for user management)
router.get('/users/:id/details', authorize('head_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get ticket statistics
    const tickets = await Ticket.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(5);
    const totalTickets = await Ticket.countDocuments({ user: req.params.id });
    const openTickets = await Ticket.countDocuments({ user: req.params.id, status: 'open' });
    const resolvedTickets = await Ticket.countDocuments({ user: req.params.id, status: 'resolved' });
    
    // Get admin statistics if applicable
    let adminStats = {};
    if (user.role === 'admin' || user.role === 'head_admin') {
      const assignedTotal = await Ticket.countDocuments({ assignedTo: req.params.id });
      const resolved = await Ticket.countDocuments({ assignedTo: req.params.id, status: 'resolved' });
      
      // Calculate average resolution time
      const resolvedTickets = await Ticket.find({ assignedTo: req.params.id, status: 'resolved' });
      let totalTime = 0;
      let count = 0;
      
      resolvedTickets.forEach(ticket => {
        if (ticket.createdAt && ticket.updatedAt) {
          totalTime += (ticket.updatedAt - ticket.createdAt);
          count++;
        }
      });
      
      const avgResolutionTime = count > 0 ? totalTime / count / (1000 * 60 * 60) : 0; // hours
      
      adminStats = {
        assignedTotal,
        resolved,
        avgResolutionTime
      };
    }
    
    res.json({ 
      success: true, 
      user,
      tickets,
      ticketStats: {
        total: totalTickets,
        open: openTickets,
        resolved: resolvedTickets
      },
      adminStats
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user details' });
  }
});

// Statistics routes
router.get('/statistics', adminController.getAdminStats);
router.get('/statistics/period/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days);
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    // Get ticket statistics for the period
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
router.get('/export/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('user', 'name email')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });
    
    // Convert to CSV
    let csv = 'ID,Title,Description,Status,Priority,Category,User,User Email,Assigned To,Created,Updated\n';
    
    tickets.forEach(ticket => {
      csv += `${ticket._id},`;
      csv += `"${ticket.title.replace(/"/g, '""')}",`;
      csv += `"${ticket.description.replace(/"/g, '""')}",`;
      csv += `${ticket.status},`;
      csv += `${ticket.priority},`;
      csv += `${ticket.category},`;
      csv += `"${ticket.user.name}",`;
      csv += `${ticket.user.email},`;
      csv += `${ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned'},`;
      csv += `${new Date(ticket.createdAt).toISOString()},`;
      csv += `${new Date(ticket.updatedAt).toISOString()}\n`;
    });
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="tickets_export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export tickets error:', error);
    res.status(500).json({ success: false, message: 'Error exporting tickets' });
  }
});

router.get('/export/performance', async (req, res) => {
  try {
    // Get performance statistics for each admin
    const admins = await User.find({ role: { $in: ['admin', 'head_admin'] } });
    
    // Convert to CSV
    let csv = 'Admin Name,Admin Email,Assigned Tickets,Resolved Tickets,Open Tickets,In Progress Tickets,Avg Resolution Time (hours)\n';
    
    for (const admin of admins) {
      const assignedTickets = await Ticket.countDocuments({ assignedTo: admin._id });
      const resolvedTickets = await Ticket.countDocuments({ assignedTo: admin._id, status: 'resolved' });
      const openTickets = await Ticket.countDocuments({ assignedTo: admin._id, status: 'open' });
      const inProgressTickets = await Ticket.countDocuments({ assignedTo: admin._id, status: 'in_progress' });
      
      // Calculate average resolution time
      const resolvedTicketsList = await Ticket.find({ assignedTo: admin._id, status: 'resolved' });
      let totalResolutionTime = 0;
      let ticketsWithResolutionTime = 0;
      
      resolvedTicketsList.forEach(ticket => {
        if (ticket.createdAt && ticket.updatedAt) {
          totalResolutionTime += (ticket.updatedAt - ticket.createdAt);
          ticketsWithResolutionTime++;
        }
      });
      
      const avgResolutionTime = ticketsWithResolutionTime > 0 
        ? (totalResolutionTime / ticketsWithResolutionTime / (1000 * 60 * 60)).toFixed(2) 
        : 0;
      
      csv += `"${admin.name}",`;
      csv += `${admin.email},`;
      csv += `${assignedTickets},`;
      csv += `${resolvedTickets},`;
      csv += `${openTickets},`;
      csv += `${inProgressTickets},`;
      csv += `${avgResolutionTime}\n`;
    }
    
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="admin_performance.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export performance error:', error);
    res.status(500).json({ success: false, message: 'Error exporting performance data' });
  }
});

module.exports = router;
