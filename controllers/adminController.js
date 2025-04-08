const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');
const { formatTimeAgo } = require('./dashboardController');

// Get all users (head admin only)
exports.getAllUsers = async (req, res) => {
  try {
    // Get all users except the current user
    const users = await User.find({ _id: { $ne: req.user._id } })
      .sort({ createdAt: -1 });
    
    // Group users by role
    const adminRequests = users.filter(user => user.role === 'admin_requester');
    const admins = users.filter(user => user.role === 'admin');
    const headAdmins = users.filter(user => user.role === 'head_admin');
    const regularUsers = users.filter(user => user.role === 'user');
    
    res.render('admin/users', {
      title: 'User Management',
      user: req.user,
      adminRequests,
      admins,
      headAdmins,
      regularUsers,
      activePage: 'users'
    });
  } catch (error) {
    console.error('Get all users error:', error);
    req.flash('error', 'Failed to get users');
    res.redirect('/admin/dashboard');
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Head admin can only be created by another head admin
    if (role === 'head_admin' && req.user.role !== 'head_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only head admins can create other head admins' 
      });
    }
    
    // Update user role
    user.role = role;
    await user.save();
    
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user role' });
  }
};

// Create a new user (head admin only)
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    
    // Validate role - only head admins can create other head admins
    if (role === 'head_admin' && req.user.role !== 'head_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only head admins can create other head admins' 
      });
    }
    
    // Create user
    const user = new User({
      name,
      email,
      password,
      role
    });
    
    await user.save();
    
    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

// Approve admin request
exports.approveAdminRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists and is an admin requester
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.role !== 'admin_requester') {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not requesting admin access' 
      });
    }
    
    // Update user role to admin
    user.role = 'admin';
    await user.save();
    
    // Send success response
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Approve admin request error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve admin request' });
  }
};

// Deny admin request
exports.denyAdminRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists and is an admin requester
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.role !== 'admin_requester') {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not requesting admin access' 
      });
    }
    
    // Update user role to regular user
    user.role = 'user';
    await user.save();
    
    // Send success response
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Deny admin request error:', error);
    res.status(500).json({ success: false, message: 'Failed to deny admin request' });
  }
};

// Get admin performance statistics
exports.getAdminStats = async (req, res) => {
  try {
    // Get ticket statistics
    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: 'open' });
    const inProgressTickets = await Ticket.countDocuments({ status: 'in_progress' });
    const resolvedTickets = await Ticket.countDocuments({ status: 'resolved' });
    
    // Get performance statistics for each admin
    const admins = await User.find({ 
      role: { $in: ['admin', 'head_admin'] }
    }).select('_id name email');
    
    const adminPerformance = [];
    
    for (const admin of admins) {
      const assignedTickets = await Ticket.countDocuments({ assignedTo: admin._id });
      const resolvedTickets = await Ticket.countDocuments({ 
        assignedTo: admin._id,
        status: 'resolved'
      });
      const openTickets = await Ticket.countDocuments({ 
        assignedTo: admin._id,
        status: 'open'
      });
      const inProgressTickets = await Ticket.countDocuments({ 
        assignedTo: admin._id,
        status: 'in_progress'
      });
      
      // Calculate average resolution time for tickets assigned to this admin
      const resolvedTicketsList = await Ticket.find({ 
        assignedTo: admin._id,
        status: 'resolved'
      });
      
      let totalResolutionTime = 0;
      let ticketsWithResolutionTime = 0;
      
      resolvedTicketsList.forEach(ticket => {
        if (ticket.createdAt && ticket.updatedAt) {
          totalResolutionTime += (ticket.updatedAt - ticket.createdAt);
          ticketsWithResolutionTime++;
        }
      });
      
      const averageResolutionTime = ticketsWithResolutionTime > 0 
        ? totalResolutionTime / ticketsWithResolutionTime 
        : 0;
      
      adminPerformance.push({
        admin,
        assignedTickets,
        resolvedTickets,
        openTickets,
        inProgressTickets,
        averageResolutionTime: averageResolutionTime / (1000 * 60 * 60) // Convert to hours
      });
    }
    
    // Sort by number of resolved tickets (highest first)
    adminPerformance.sort((a, b) => b.resolvedTickets - a.resolvedTickets);
    
    // Get category statistics
    const categoryStats = await Ticket.aggregate([
      { $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get priority statistics
    const priorityStats = await Ticket.aggregate([
      { $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get ticket creation over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ticketsOverTime = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    res.render('admin/statistics', {
      title: 'System Statistics',
      user: req.user,
      activePage: 'statistics',
      stats: {
        total: totalTickets,
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets
      },
      adminPerformance,
      categoryStats,
      priorityStats,
      ticketsOverTime
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    req.flash('error', 'Failed to get statistics');
    res.redirect('/admin/dashboard');
  }
};
