const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');
const argon2 = require('argon2'); // Replaced bcrypt with argon2

/**
 * @desc    Get user dashboard
 * @route   GET /user/dashboard
 * @access  Private
 */
exports.getUserDashboard = async (req, res) => {
  try {
    // Get user's tickets
    const tickets = await Ticket.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'name');
    
    // Get user's recent messages
    const messages = await Message.find({
      $or: [{ sender: req.user.id }, { recipient: req.user.id }]
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('sender', 'name role')
    .populate('recipient', 'name role');
    
    res.render('user/dashboard', {
      title: 'Bruker Dashboard',
      activePage: 'dashboard',
      tickets,
      messages
    });
  } catch (error) {
    console.error('Error loading user dashboard:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste dashboard',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get user tickets
 * @route   GET /user/tickets
 * @access  Private
 */
exports.getUserTickets = async (req, res) => {
  try {
    // Get user's tickets
    const tickets = await Ticket.find({ user: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('assignedTo', 'name')
      .populate('user', 'name');
    
    res.render('user/tickets', {
      title: 'Mine Saker',
      activePage: 'tickets',
      tickets
    });
  } catch (error) {
    console.error('Error loading user tickets:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste saker',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get user settings page
 * @route   GET /user/settings
 * @access  Private
 */
exports.getUserSettings = async (req, res) => {
  try {
    // Get fresh user data
    const user = await User.findById(req.user.id);
    
    res.render('user/settings', {
      title: 'Innstillinger',
      activePage: 'settings',
      user
    });
  } catch (error) {
    console.error('Error loading user settings:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste innstillinger',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get admin dashboard
 * @route   GET /admin/dashboard
 * @access  Private/Admin
 */
exports.getAdminDashboard = async (req, res) => {
  try {
    // Get assigned tickets
    const myTickets = await Ticket.find({ assignedTo: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('user', 'name');
    
    // Get all open tickets
    const openTickets = await Ticket.find({ status: 'open', assignedTo: null })
      .sort({ createdAt: -1 })
      .populate('user', 'name');
    
    // Get active chats (stub - replace with actual chat data when implemented)
    const chats = [];
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      activePage: 'dashboard',
      myTickets,
      openTickets,
      chats
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste admin dashboard',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get admin tickets page
 * @route   GET /admin/tickets
 * @access  Private/Admin
 */
exports.getAdminTickets = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    // Apply filters if present
    let filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    
    // Count total tickets for pagination
    const total = await Ticket.countDocuments(filter);
    
    // Get tickets
    const tickets = await Ticket.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name')
      .populate('assignedTo', 'name');
    
    // Get all admins for assignment
    const admins = await User.find({ 
      role: { $in: ['admin', 'head_admin'] } 
    }).select('name email status');
    
    res.render('admin/tickets', {
      title: 'Alle saker',
      activePage: 'tickets',
      tickets,
      admins,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error loading admin tickets:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste saker',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get assigned tickets page
 * @route   GET /admin/tickets/assigned
 * @access  Private/Admin
 */
exports.getAssignedTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ assignedTo: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('user', 'name');
    
    res.render('admin/assigned-tickets', {
      title: 'Mine tildelte saker',
      activePage: 'tickets',
      tickets
    });
  } catch (error) {
    console.error('Error loading assigned tickets:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste tildelte saker',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get admin messages page
 * @route   GET /admin/messages
 * @access  Private/Admin
 */
exports.getAdminMessages = async (req, res) => {
  try {
    res.render('admin/messages', {
      title: 'Meldinger',
      activePage: 'messages'
    });
  } catch (error) {
    console.error('Error loading admin messages:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste meldinger',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get admin statistics page
 * @route   GET /admin/statistics
 * @access  Private/Admin
 */
exports.getAdminStatistics = async (req, res) => {
  try {
    // Get counts for different ticket statuses
    const openCount = await Ticket.countDocuments({ status: 'open' });
    const inProgressCount = await Ticket.countDocuments({ status: 'in_progress' });
    const resolvedCount = await Ticket.countDocuments({ status: 'resolved' });
    
    // Get counts for different priorities
    const highPriorityCount = await Ticket.countDocuments({ priority: 'high' });
    const mediumPriorityCount = await Ticket.countDocuments({ priority: 'medium' });
    const lowPriorityCount = await Ticket.countDocuments({ priority: 'low' });
    
    // Get counts for different categories
    const technicalCount = await Ticket.countDocuments({ category: 'technical' });
    const accountCount = await Ticket.countDocuments({ category: 'account' });
    const billingCount = await Ticket.countDocuments({ category: 'billing' });
    const featureCount = await Ticket.countDocuments({ category: 'feature' });
    const otherCount = await Ticket.countDocuments({ category: 'other' });
    
    res.render('admin/statistics', {
      title: 'Statistikk',
      activePage: 'statistics',
      stats: {
        status: {
          open: openCount,
          in_progress: inProgressCount,
          resolved: resolvedCount
        },
        priority: {
          high: highPriorityCount,
          medium: mediumPriorityCount,
          low: lowPriorityCount
        },
        category: {
          technical: technicalCount,
          account: accountCount,
          billing: billingCount,
          feature: featureCount,
          other: otherCount
        }
      }
    });
  } catch (error) {
    console.error('Error loading statistics:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste statistikk',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get admin users management page
 * @route   GET /admin/users
 * @access  Private/HeadAdmin
 */
exports.getAdminUsers = async (req, res) => {
  try {
    // Get all users
    const users = await User.find({ role: 'user' }).sort({ name: 1 });
    
    // Get pending admin requests
    const pendingAdmins = await User.find({ 
      adminRequest: true,
      role: 'user'
    }).sort({ adminRequestDate: 1 });
    
    res.render('admin/users', {
      title: 'Brukeradministrasjon',
      activePage: 'users',
      users,
      pendingAdmins
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste brukere',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get admin staff management page
 * @route   GET /admin/staff
 * @access  Private/Admin
 */
exports.getAdminStaff = async (req, res) => {
  try {
    // Get all admin users
    const admins = await User.find({ 
      role: { $in: ['admin', 'head_admin'] } 
    }).sort({ name: 1 });
    
    res.render('admin/staff', {
      title: 'Support-ansatte',
      activePage: 'staff',
      admins
    });
  } catch (error) {
    console.error('Error loading staff:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste ansatte',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Get admin settings page
 * @route   GET /admin/settings
 * @access  Private/Admin
 */
exports.getAdminSettings = async (req, res) => {
  try {
    // Get fresh user data
    const user = await User.findById(req.user.id);
    
    res.render('admin/settings', {
      title: 'Innstillinger',
      activePage: 'settings',
      user
    });
  } catch (error) {
    console.error('Error loading admin settings:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste innstillinger',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Update user settings
 * @route   POST /user/settings/update
 * @access  Private
 */
exports.updateUserSettings = async (req, res) => {
  try {
    const { name, email, theme, notifications } = req.body;
    
    // Update user
    await User.findByIdAndUpdate(req.user.id, {
      name,
      email,
      'preferences.theme': theme,
      'preferences.notifications': notifications
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Kunne ikke oppdatere innstillinger' 
    });
  }
};

/**
 * @desc    Update user password
 * @route   POST /user/settings/password
 * @access  Private
 */
exports.updateUserPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Nåværende passord er ikke korrekt'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Kunne ikke oppdatere passord'
    });
  }
};

/**
 * @desc    Update admin settings
 * @route   POST /admin/settings/update
 * @access  Private/Admin
 */
exports.updateAdminSettings = async (req, res) => {
  try {
    const { status, theme, specializations, maxConcurrentChats } = req.body;
    
    // Build update object
    const updateData = {};
    if (status) updateData.status = status;
    if (theme) updateData['preferences.theme'] = theme;
    if (specializations) updateData.specializations = specializations;
    if (maxConcurrentChats) updateData.maxConcurrentChats = maxConcurrentChats;
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id, 
      updateData, 
      { new: true }
    );
    
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Kunne ikke oppdatere innstillinger' 
    });
  }
};

// Head admin dashboard
exports.getHeadAdminDashboard = async (req, res) => {
  // Head admin dashboard is the same as admin dashboard with additional stats
  exports.getAdminDashboard(req, res);
};

// Waiting page for admin requesters
exports.getWaitingPage = async (req, res) => {
  try {
    res.render('user/waiting', {
      title: 'Admin Request Pending',
      user: req.user
    });
  } catch (error) {
    console.error('Waiting page error:', error);
    res.status(500).render('error', { error: 'Failed to load waiting page' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Check if passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/user/settings');
    }
    
    // Get user
    const user = await User.findById(req.user._id);
    
    // Check current password
    const isMatch = await argon2.verify(user.password, currentPassword);
    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/user/settings');
    }
    
    // Hash new password
    user.password = await argon2.hash(newPassword);
    
    await user.save();
    
    req.flash('success', 'Password changed successfully');
    res.redirect('/user/settings');
  } catch (error) {
    console.error('Change password error:', error);
    req.flash('error', 'Failed to change password');
    res.redirect('/user/settings');
  }
};

// Utility function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  
  // Convert milliseconds to seconds
  const seconds = Math.floor(diff / 1000);
  
  // Less than a minute
  if (seconds < 60) {
    return 'just now';
  }
  
  // Minutes
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // Hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Days
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Default to date
  return new Date(date).toLocaleDateString();
}

// Make the formatTimeAgo function available to all controllers
exports.formatTimeAgo = formatTimeAgo;
