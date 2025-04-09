const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');
const argon2 = require('argon2'); // Replaced bcrypt with argon2
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
    
    // Create new user - User model will handle argon2 hashing
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
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

// Get admin settings page
exports.getAdminSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.render('admin/settings', {
      title: 'Admin Settings',
      user,
      activePage: 'settings'
    });
  } catch (error) {
    console.error('Get admin settings error:', error);
    req.flash('error', 'Failed to load settings');
    res.redirect('/admin/dashboard');
  }
};

// Update admin settings
exports.updateAdminSettings = async (req, res) => {
  try {
    const { status, specializations, maxConcurrentChats, theme } = req.body;
    
    const updateData = {};
    
    // Update status if provided
    if (status && ['available', 'working', 'offline'].includes(status)) {
      updateData.status = status;
    }
    
    // Update specializations if provided
    if (specializations && Array.isArray(specializations)) {
      const validCategories = ['technical', 'account', 'billing', 'feature', 'other'];
      updateData.specializations = specializations.filter(spec => 
        validCategories.includes(spec)
      );
    }
    
    // Update max concurrent chats if provided
    if (maxConcurrentChats) {
      const maxChats = parseInt(maxConcurrentChats);
      if (!isNaN(maxChats) && maxChats >= 1 && maxChats <= 10) {
        updateData.maxConcurrentChats = maxChats;
      }
    }
    
    // Update theme preference
    if (theme && ['light', 'dark'].includes(theme)) {
      updateData['preferences.theme'] = theme;
    }
    
    // Update user with all valid changes
    const user = await User.findByIdAndUpdate(
      req.user._id, 
      updateData, 
      { new: true }
    );
    
    // If status was updated, notify connected clients
    if (updateData.status && req.io) {
      req.io.emit('admin-status-changed', {
        adminId: req.user._id,
        status: updateData.status
      });
    }
    
    // Return JSON if it's an API request
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        user
      });
    }
    
    // Otherwise redirect with flash message
    req.flash('success', 'Settings updated successfully');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Update admin settings error:', error);
    
    // Return JSON if it's an API request
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Error updating settings'
      });
    }
    
    req.flash('error', 'Failed to update settings');
    res.redirect('/admin/settings');
  }
};

// Update admin status
exports.updateAdminStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    if (!['available', 'working', 'offline'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    // Update user status
    const user = await User.findByIdAndUpdate(
      req.user._id, 
      { status }, 
      { new: true }
    );
    
    // Notify connected clients
    if (req.io) {
      req.io.emit('admin-status-changed', {
        adminId: req.user._id,
        status
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      user
    });
  } catch (error) {
    console.error('Update admin status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating status'
    });
  }
};

// Update admin specializations
exports.updateSpecializations = async (req, res) => {
  try {
    const { specializations } = req.body;
    
    if (!Array.isArray(specializations)) {
      return res.status(400).json({
        success: false,
        message: 'Specializations must be an array'
      });
    }
    
    // Validate specializations
    const validCategories = ['technical', 'account', 'billing', 'feature', 'other'];
    const validSpecializations = specializations.filter(spec => 
      validCategories.includes(spec)
    );
    
    // Update user specializations
    const user = await User.findByIdAndUpdate(
      req.user._id, 
      { specializations: validSpecializations }, 
      { new: true }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Specializations updated successfully',
      user
    });
  } catch (error) {
    console.error('Update specializations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating specializations'
    });
  }
};

// Update max concurrent chats
exports.updateMaxChats = async (req, res) => {
  try {
    const { maxConcurrentChats } = req.body;
    
    // Validate max chats
    const maxChats = parseInt(maxConcurrentChats);
    if (isNaN(maxChats) || maxChats < 1 || maxChats > 10) {
      return res.status(400).json({
        success: false,
        message: 'Max concurrent chats must be between 1 and 10'
      });
    }
    
    // Update user max chats
    const user = await User.findByIdAndUpdate(
      req.user._id, 
      { maxConcurrentChats: maxChats }, 
      { new: true }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Max concurrent chats updated successfully',
      user
    });
  } catch (error) {
    console.error('Update max chats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating max concurrent chats'
    });
  }
};

// Get staff management page
exports.getStaffPage = async (req, res) => {
  try {
    // Ensure user is head admin
    if (req.user.role !== 'head_admin') {
      req.flash('error', 'You do not have permission to access this page');
      return res.redirect('/admin/dashboard');
    }
    
    // Get all admins
    const admins = await User.find({ 
      role: { $in: ['admin', 'head_admin'] }
    }).select('-password');
    
    // For each admin, count their assigned tickets
    for (let admin of admins) {
      const assignedTickets = await Ticket.countDocuments({ assignedTo: admin._id });
      admin = admin.toObject();
      admin.assignedTickets = assignedTickets;
    }
    
    res.render('admin/staff', {
      title: 'Staff Management',
      admins,
      user: req.user,
      activePage: 'staff'
    });
  } catch (error) {
    console.error('Get staff page error:', error);
    req.flash('error', 'Failed to load staff page');
    res.redirect('/admin/dashboard');
  }
};

// Add a new admin
exports.addAdmin = async (req, res) => {
  try {
    // Ensure user is head admin
    if (req.user.role !== 'head_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    
    const { name, email, password, specializations, maxConcurrentChats } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }
    
    // Create new admin
    const newAdmin = new User({
      name,
      email,
      password, // This will be hashed in the User model pre-save hook
      role: 'admin',
      specializations: specializations || [],
      maxConcurrentChats: maxConcurrentChats || 3,
      status: 'available'
    });
    
    await newAdmin.save();
    
    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('admin-added', {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        status: newAdmin.status,
        specializations: newAdmin.specializations,
        maxConcurrentChats: newAdmin.maxConcurrentChats
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Admin added successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email
      }
    });
  } catch (error) {
    console.error('Add admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add admin'
    });
  }
};

// Update admin settings
exports.updateAdminById = async (req, res) => {
  try {
    // Ensure user is head admin
    if (req.user.role !== 'head_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    
    const adminId = req.params.id;
    const { status, specializations, maxConcurrentChats } = req.body;
    
    // Get the admin
    const admin = await User.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    // Update admin
    if (status) admin.status = status;
    if (specializations) admin.specializations = specializations;
    if (maxConcurrentChats) admin.maxConcurrentChats = maxConcurrentChats;
    
    await admin.save();
    
    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit('admin-status-changed', {
        adminId: admin._id,
        status: admin.status
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        status: admin.status,
        specializations: admin.specializations,
        maxConcurrentChats: admin.maxConcurrentChats
      }
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update admin'
    });
  }
};

// Get admin performance
exports.getAdminPerformance = async (req, res) => {
  try {
    const adminId = req.params.id;
    
    // Get admin details
    const admin = await User.findById(adminId).select('-password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    // Get assigned tickets
    const assignedTickets = await Ticket.find({ assignedTo: adminId });
    
    // Calculate metrics
    const resolvedTickets = assignedTickets.filter(t => t.status === 'resolved').length;
    const activeChats = admin.activeChats ? admin.activeChats.length : 0;
    const pendingChats = admin.chatQueue ? admin.chatQueue.length : 0;
    
    // Get response time (placeholder data in a real app)
    const averageResponseTime = '2.5 min'; // This would be calculated from actual messages
    
    return res.status(200).json({
      success: true,
      performance: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          status: admin.status,
          specializations: admin.specializations
        },
        assignedTickets: assignedTickets.length,
        resolvedTickets,
        activeChats,
        pendingChats,
        averageResponseTime
      }
    });
  } catch (error) {
    console.error('Get admin performance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get admin performance'
    });
  }
};

// Update admin function to change user password
exports.updateUserPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update password - User model will handle argon2 hashing
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update user password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password'
    });
  }
};

// Update admin settings
exports.updateSettings = async (req, res) => {
  try {
    const { status, specializations, maxConcurrentChats, theme } = req.body;
    
    // Update fields
    const updateFields = {};
    
    if (status) {
      updateFields.status = status;
    }
    
    if (specializations) {
      updateFields.specializations = Array.isArray(specializations) ? 
        specializations : [specializations];
    }
    
    if (maxConcurrentChats) {
      updateFields.maxConcurrentChats = Math.min(10, Math.max(1, maxConcurrentChats));
    }
    
    if (theme) {
      updateFields['preferences.theme'] = theme;
    }
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );
    
    // Emit socket event for status change if applicable
    if (status && req.io) {
      req.io.emit('admin-status-changed', {
        adminId: req.user._id,
        status
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      user
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
};
